from flask import Blueprint, request, jsonify
from extensions import db, bcrypt, mail
from models.user import User
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from flask_mail import Message
import secrets
import cloudinary
import cloudinary.uploader
import os
import pyotp
import qrcode
import io
import base64
import json

auth_bp = Blueprint("auth", __name__)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)


def _tokens(user):
    return {
        "access_token": create_access_token(identity=str(user.id)),
        "refresh_token": create_refresh_token(identity=str(user.id)),
        "user": user.to_dict()
    }


@auth_bp.route("/register", methods=["POST"])
def register():
    import random
    from datetime import datetime, timedelta
    data = request.json or {}

    email = data.get("email", "").strip().lower()
    username = data.get("username", "").strip().lower()
    name = data.get("name", "").strip()
    password = data.get("password", "")

    if not email or not username or not name or not password:
        return jsonify({"error": "All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    # Same email cannot be registered twice
    existing_email = User.query.filter_by(email=email).first()
    if existing_email:
        if existing_email.google_id and not existing_email.password:
            return jsonify({"error": "This email is linked to a Google account. Please sign in with Google."}), 409
        # If unverified, resend OTP instead of blocking
        if not existing_email.is_verified:
            otp = str(random.randint(100000, 999999))
            expiry = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
            existing_email.verification_token = f"otp:{otp}:{expiry}"
            db.session.commit()
            try:
                msg = Message("Verify your KinsCribe account", recipients=[email])
                msg.html = _otp_email_html(existing_email.name, otp)
                mail.send(msg)
                return jsonify({"message": "OTP resent to your email.", "requires_otp": True, "email": email}), 200
            except Exception:
                existing_email.is_verified = True
                existing_email.verification_token = None
                db.session.commit()
                return jsonify({**_tokens(existing_email), "requires_otp": False}), 200
        return jsonify({"error": "This email is already registered. Please sign in."}), 409

    # Same username+email combo cannot exist — but same username on different email is fine
    existing_username_email = User.query.filter_by(username=username, email=email).first()
    if existing_username_email:
        return jsonify({"error": "This username is already taken for this email."}), 409

    otp = str(random.randint(100000, 999999))
    expiry = (datetime.utcnow() + timedelta(minutes=15)).isoformat()

    user = User(
        name=name,
        username=username,
        email=email,
        password=bcrypt.generate_password_hash(password).decode("utf-8"),
        verification_token=f"otp:{otp}:{expiry}",
        is_verified=False
    )
    db.session.add(user)
    db.session.commit()

    try:
        msg = Message("Verify your KinsCribe account", recipients=[email])
        msg.html = _otp_email_html(name, otp)
        mail.send(msg)
        return jsonify({"message": "OTP sent to your email.", "requires_otp": True, "email": email}), 201
    except Exception:
        # Email not configured — auto-verify so user isn't stuck
        user.is_verified = True
        user.verification_token = None
        db.session.commit()
        return jsonify({**_tokens(user), "message": "Registered successfully.", "requires_otp": False}), 201


def _otp_email_html(name, otp):
    return f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
      <h2 style="color:#7c3aed;margin-bottom:4px">KinsCribe</h2>
      <p style="color:#94a3b8;margin-top:0">Email Verification</p>
      <hr style="border-color:#1e293b;margin:20px 0">
      <p>Hi <strong>{name}</strong>, welcome to KinsCribe!</p>
      <p>Use the code below to verify your email. It expires in <strong>15 minutes</strong>.</p>
      <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
        <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#7c3aed">{otp}</span>
      </div>
      <p style="color:#94a3b8;font-size:13px">If you didn't create this account, ignore this email.</p>
    </div>
    """


@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    from datetime import datetime
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "Account not found"}), 404

    if user.is_verified:
        return jsonify({**_tokens(user), "already_verified": True})

    token = user.verification_token or ""
    if not token.startswith("otp:"):
        return jsonify({"error": "No OTP pending for this account"}), 400

    try:
        _, stored_otp, expiry_str = token.split(":", 2)
        if stored_otp != otp:
            return jsonify({"error": "Incorrect code. Please try again."}), 400
        if datetime.utcnow() > datetime.fromisoformat(expiry_str):
            return jsonify({"error": "Code has expired. Please register again."}), 400
    except Exception:
        return jsonify({"error": "Invalid OTP"}), 400

    user.is_verified = True
    user.verification_token = None
    db.session.commit()
    return jsonify({**_tokens(user), "message": "Email verified successfully!"})


@auth_bp.route("/resend-otp", methods=["POST"])
def resend_otp():
    import random
    from datetime import datetime, timedelta
    data = request.json or {}
    email = data.get("email", "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user or user.is_verified:
        return jsonify({"error": "Account not found or already verified"}), 400

    otp = str(random.randint(100000, 999999))
    expiry = (datetime.utcnow() + timedelta(minutes=15)).isoformat()
    user.verification_token = f"otp:{otp}:{expiry}"
    db.session.commit()

    try:
        msg = Message("Your new KinsCribe verification code", recipients=[user.email])
        msg.html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
          <h2 style="color:#7c3aed">KinsCribe</h2>
          <p>Your new verification code:</p>
          <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#7c3aed">{otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px">Expires in 15 minutes.</p>
        </div>
        """
        mail.send(msg)
        return jsonify({"message": "New OTP sent."})
    except Exception as e:
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500


@auth_bp.route("/google", methods=["POST"])
def google_auth():
    """Accept Google access token + pre-fetched user_info from client."""
    import requests as http_requests

    data = request.json or {}
    access_token = data.get("id_token")
    client_user_info = data.get("user_info", {})

    if not access_token:
        return jsonify({"error": "No token provided"}), 400

    # Use pre-fetched user_info from client if available (avoids double-fetch timeout)
    # Fall back to fetching from Google if not provided
    if client_user_info and client_user_info.get("email"):
        info = client_user_info
    else:
        try:
            resp = http_requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10
            )
            if resp.status_code != 200:
                return jsonify({"error": "Invalid Google token"}), 401
            info = resp.json()
        except Exception as e:
            return jsonify({"error": f"Token verification failed: {str(e)}"}), 401

    google_id = info.get("sub")
    email = info.get("email")
    name = info.get("name") or info.get("given_name", "User")
    avatar_url = info.get("picture", "")

    if not email:
        return jsonify({"error": "Could not retrieve email from Google"}), 401

    user = User.query.filter_by(google_id=google_id).first() if google_id else None
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            if google_id and not user.google_id:
                user.google_id = google_id
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
        else:
            user = User(
                name=name,
                email=email,
                google_id=google_id,
                avatar_url=avatar_url,
                is_verified=True
            )
            db.session.add(user)
    db.session.commit()

    return jsonify({**_tokens(user), "is_new_user": user.username is None})


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    import random
    from datetime import datetime, timedelta

    email = request.json.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "No account found with this email address"}), 404

    if user.google_id and not user.password:
        return jsonify({"error": "This account uses Google Sign-In. No password to reset."}), 400

    # Generate a 6-digit OTP
    otp = str(random.randint(100000, 999999))
    user.verification_token = f"otp:{otp}:{(datetime.utcnow() + timedelta(minutes=15)).isoformat()}"
    db.session.commit()

    try:
        msg = Message("Your KinsCribe password reset code", recipients=[user.email])
        msg.html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
          <h2 style="color:#7c3aed;margin-bottom:4px">KinsCribe</h2>
          <p style="color:#94a3b8;margin-top:0">Password Reset</p>
          <hr style="border-color:#1e293b;margin:20px 0">
          <p>Hi <strong>{user.name}</strong>,</p>
          <p>Use the code below to reset your password. It expires in <strong>15 minutes</strong>.</p>
          <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#7c3aed">{otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        </div>
        """
        mail.send(msg)
        return jsonify({"message": "A 6-digit reset code was sent to your email."}), 200
    except Exception as e:
        print(f"Mail error: {e}")
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    from datetime import datetime
    data = request.json
    otp = data.get("token", "").strip()
    new_password = data.get("password", "")

    if not otp or not new_password or len(new_password) < 6:
        return jsonify({"error": "Invalid request"}), 400

    # Find user with matching OTP token
    users = User.query.filter(User.verification_token.like(f"otp:{otp}:%")).all()
    if not users:
        return jsonify({"error": "Invalid or expired code"}), 400

    user = users[0]
    # Check expiry
    try:
        _, stored_otp, expiry_str = user.verification_token.split(":", 2)
        if stored_otp != otp or datetime.utcnow() > datetime.fromisoformat(expiry_str):
            return jsonify({"error": "Code has expired. Please request a new one."}), 400
    except Exception:
        return jsonify({"error": "Invalid or expired code"}), 400

    user.password = bcrypt.generate_password_hash(new_password).decode("utf-8")
    user.verification_token = None
    db.session.commit()
    return jsonify({"message": "Password reset successfully."})



@auth_bp.route("/verify/<token>", methods=["GET"])
def verify_email(token):
    user = User.query.filter_by(verification_token=token).first()
    if not user:
        return jsonify({"error": "Invalid token"}), 404
    user.is_verified = True
    user.verification_token = None
    db.session.commit()
    return jsonify({"message": "Email verified"})


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    user = User.query.filter_by(email=data["email"]).first()

    if not user:
        return jsonify({"error": "No account found with this email"}), 401
    if user.google_id and not user.password:
        return jsonify({"error": "This account uses Google Sign-In. Please tap \"Continue with Google\"."}), 401
    if not bcrypt.check_password_hash(user.password, data["password"]):
        return jsonify({"error": "Incorrect password"}), 401

    return jsonify(_tokens(user))


@auth_bp.route("/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    import base64, re
    user = User.query.get(int(get_jwt_identity()))

    # Accept either multipart file OR base64 JSON body
    if "file" in request.files:
        file_data = request.files["file"]
        result = cloudinary.uploader.upload(
            file_data,
            folder="kinscribe/avatars",
            transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}]
        )
    else:
        body = request.get_json(silent=True) or {}
        b64 = body.get("image")
        if not b64:
            return jsonify({"error": "No file provided"}), 400
        # strip data URI prefix if present
        b64 = re.sub(r"^data:image/[^;]+;base64,", "", b64)
        file_bytes = base64.b64decode(b64)
        result = cloudinary.uploader.upload(
            file_bytes,
            folder="kinscribe/avatars",
            transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}]
        )

    user.avatar_url = result["secure_url"]
    db.session.commit()
    return jsonify({"avatar_url": user.avatar_url, "user": user.to_dict()})


@auth_bp.route("/username/check", methods=["GET"])
def check_username():
    username = request.args.get("username", "").strip().lower()
    email = request.args.get("email", "").strip().lower()
    if not username or len(username) < 3:
        return jsonify({"available": False, "error": "Too short"})
    if not username.replace('_', '').replace('.', '').isalnum():
        return jsonify({"available": False, "error": "Only letters, numbers, _ and . allowed"})
    # Username is only taken if same username+email combo exists
    if email:
        exists = User.query.filter_by(username=username, email=email).first()
    else:
        exists = User.query.filter_by(username=username).first()
    return jsonify({"available": not exists})


@auth_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user = User.query.get(int(get_jwt_identity()))
    data = request.get_json() or {}
    if "name" in data and data["name"].strip():
        user.name = data["name"].strip()
    if "bio" in data:
        user.bio = data["bio"]
    if "username" in data and data["username"].strip():
        existing = User.query.filter_by(username=data["username"]).first()
        if existing and existing.id != user.id:
            return jsonify({"error": "Username already taken"}), 409
        user.username = data["username"].strip().lower()
    if "website" in data:
        user.website = data.get("website", "")
    if "interests" in data:
        user.interests = data.get("interests", "")
    if "is_private" in data:
        user.is_private = bool(data["is_private"])
    db.session.commit()
    return jsonify({"user": user.to_dict()})


@auth_bp.route("/account", methods=["DELETE"])
@jwt_required()
def delete_account():
    user = User.query.get(int(get_jwt_identity()))
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Account deleted"})


@auth_bp.route("/deactivate", methods=["POST"])
@jwt_required()
def deactivate_account():
    # Soft deactivate: store flag in verification_token field temporarily
    user = User.query.get(int(get_jwt_identity()))
    user.verification_token = "deactivated"
    db.session.commit()
    return jsonify({"message": "Account deactivated"})


@auth_bp.route("/phone/send-otp", methods=["POST"])
def send_phone_otp():
    """Send OTP to phone number for login/registration"""
    import random
    from datetime import datetime, timedelta
    
    data = request.json or {}
    phone = data.get("phone", "").strip()
    
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400
    
    # Validate international phone format
    if not phone.startswith('+'):
        return jsonify({"error": "Phone number must include country code (e.g., +254729569010)"}), 400
    
    # Remove + and validate digits
    phone_digits = phone[1:]
    if not phone_digits.isdigit() or len(phone_digits) < 7 or len(phone_digits) > 15:
        return jsonify({"error": "Invalid phone number format"}), 400
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    expiry = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    
    # Check if user exists
    user = User.query.filter_by(phone=phone).first()
    if not user:
        # Create new user for phone registration
        user = User(
            name="Phone User",  # Will be updated during profile setup
            phone=phone,
            verification_token=f"phone_otp:{otp}:{expiry}",
            is_verified=False
        )
        db.session.add(user)
    else:
        user.verification_token = f"phone_otp:{otp}:{expiry}"
    
    db.session.commit()
    
    # Format phone for display (mask middle digits)
    display_phone = phone[:4] + '*' * (len(phone) - 8) + phone[-4:] if len(phone) > 8 else phone
    
    # TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    # For now, return OTP in response (development only)
    return jsonify({
        "message": f"OTP sent to {display_phone}",
        "phone": phone,
        "otp": otp if os.getenv("FLASK_ENV") == "development" else None
    })


@auth_bp.route("/phone/verify-otp", methods=["POST"])
def verify_phone_otp():
    """Verify phone OTP and login/register user"""
    from datetime import datetime
    
    data = request.json or {}
    phone = data.get("phone", "").strip()
    otp = data.get("otp", "").strip()
    name = data.get("name", "").strip()  # For new registrations
    
    if not phone or not otp:
        return jsonify({"error": "Phone and OTP are required"}), 400
    
    # Validate international phone format
    if not phone.startswith('+'):
        return jsonify({"error": "Invalid phone format"}), 400
    
    user = User.query.filter_by(phone=phone).first()
    if not user:
        return jsonify({"error": "Phone number not found"}), 404
    
    token = user.verification_token or ""
    if not token.startswith("phone_otp:"):
        return jsonify({"error": "No OTP pending for this phone"}), 400
    
    try:
        _, stored_otp, expiry_str = token.split(":", 2)
        if stored_otp != otp:
            return jsonify({"error": "Incorrect OTP"}), 400
        if datetime.utcnow() > datetime.fromisoformat(expiry_str):
            return jsonify({"error": "OTP has expired"}), 400
    except Exception:
        return jsonify({"error": "Invalid OTP"}), 400
    
    # Update user info for new registrations
    is_new_user = user.name == "Phone User"
    if is_new_user and name:
        user.name = name
    
    user.is_verified = True
    user.verification_token = None
    db.session.commit()
    
    return jsonify({
        **_tokens(user),
        "is_new_user": is_new_user,
        "message": "Phone verified successfully!"
    })


@auth_bp.route("/apple", methods=["POST"])
def apple_auth():
    """Apple Sign-In authentication"""
    data = request.json or {}
    identity_token = data.get("identity_token")
    user_info = data.get("user_info", {})
    
    if not identity_token:
        return jsonify({"error": "Identity token required"}), 400
    
    try:
        # TODO: Verify Apple identity token
        # For now, extract user info from the provided data
        apple_id = user_info.get("sub") or user_info.get("id")
        email = user_info.get("email")
        name = user_info.get("name", {}).get("firstName", "Apple User")
        
        if not apple_id:
            return jsonify({"error": "Invalid Apple token"}), 401
        
        # Find existing user
        user = User.query.filter_by(apple_id=apple_id).first()
        if not user and email:
            user = User.query.filter_by(email=email).first()
            if user:
                user.apple_id = apple_id
        
        if not user:
            user = User(
                name=name,
                email=email,
                apple_id=apple_id,
                is_verified=True
            )
            db.session.add(user)
        
        db.session.commit()
        
        return jsonify({
            **_tokens(user),
            "is_new_user": user.username is None
        })
        
    except Exception as e:
        return jsonify({"error": f"Apple authentication failed: {str(e)}"}), 401


@auth_bp.route("/2fa/setup", methods=["POST"])
@jwt_required()
def setup_2fa():
    """Setup 2FA for user account"""
    import pyotp
    import qrcode
    import io
    import base64
    
    user = User.query.get(int(get_jwt_identity()))
    
    if user.two_factor_enabled:
        return jsonify({"error": "2FA is already enabled"}), 400
    
    # Generate secret
    secret = pyotp.random_base32()
    
    # Generate QR code
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user.email or user.phone,
        issuer_name="KinsCribe"
    )
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    qr_code = base64.b64encode(buffer.getvalue()).decode()
    
    # Store secret temporarily (not enabled until verified)
    user.two_factor_secret = secret
    db.session.commit()
    
    return jsonify({
        "secret": secret,
        "qr_code": f"data:image/png;base64,{qr_code}",
        "manual_entry_key": secret
    })


@auth_bp.route("/2fa/verify", methods=["POST"])
@jwt_required()
def verify_2fa_setup():
    """Verify 2FA setup with TOTP code"""
    import pyotp
    import secrets
    import json
    
    user = User.query.get(int(get_jwt_identity()))
    data = request.json or {}
    code = data.get("code", "").strip()
    
    if not user.two_factor_secret:
        return jsonify({"error": "2FA setup not initiated"}), 400
    
    if not code:
        return jsonify({"error": "Verification code required"}), 400
    
    # Verify TOTP code
    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(code, valid_window=1):
        return jsonify({"error": "Invalid verification code"}), 400
    
    # Generate backup codes
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    
    # Enable 2FA
    user.two_factor_enabled = True
    user.backup_codes = json.dumps(backup_codes)
    db.session.commit()
    
    return jsonify({
        "message": "2FA enabled successfully",
        "backup_codes": backup_codes
    })


@auth_bp.route("/2fa/disable", methods=["POST"])
@jwt_required()
def disable_2fa():
    """Disable 2FA for user account"""
    user = User.query.get(int(get_jwt_identity()))
    data = request.json or {}
    password = data.get("password", "")
    
    if not user.two_factor_enabled:
        return jsonify({"error": "2FA is not enabled"}), 400
    
    # Verify password
    if user.password and not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "Incorrect password"}), 401
    
    # Disable 2FA
    user.two_factor_enabled = False
    user.two_factor_secret = None
    user.backup_codes = None
    db.session.commit()
    
@auth_bp.route("/phone/add", methods=["POST"])
@jwt_required()
def add_phone_number():
    """Add phone number to existing account"""
    import random
    from datetime import datetime, timedelta
    
    user = User.query.get(int(get_jwt_identity()))
    data = request.json or {}
    phone = data.get("phone", "").strip()
    otp = data.get("otp", "").strip()
    
    if not phone or not otp:
        return jsonify({"error": "Phone and OTP are required"}), 400
    
    # Normalize phone
    phone = ''.join(filter(str.isdigit, phone))
    if not phone.startswith('1') and len(phone) == 10:
        phone = '1' + phone
    
    # Check if phone is already used
    existing = User.query.filter(User.phone == phone, User.id != user.id).first()
    if existing:
        return jsonify({"error": "This phone number is already registered"}), 409
    
    # Verify OTP (stored in verification_token temporarily)
    token = user.verification_token or ""
    if not token.startswith("phone_otp:"):
        return jsonify({"error": "No OTP pending for phone verification"}), 400
    
    try:
        _, stored_otp, expiry_str = token.split(":", 2)
        if stored_otp != otp:
            return jsonify({"error": "Incorrect OTP"}), 400
        if datetime.utcnow() > datetime.fromisoformat(expiry_str):
            return jsonify({"error": "OTP has expired"}), 400
    except Exception:
        return jsonify({"error": "Invalid OTP"}), 400
    
    # Add phone to user account
    user.phone = phone
    user.verification_token = None
    db.session.commit()
    
    return jsonify({
        "message": "Phone number added successfully",
        "user": user.to_dict()
    })


@auth_bp.route("/phone/send-add-otp", methods=["POST"])
@jwt_required()
def send_add_phone_otp():
    """Send OTP to add phone number to existing account"""
    import random
    from datetime import datetime, timedelta
    
    user = User.query.get(int(get_jwt_identity()))
    data = request.json or {}
    phone = data.get("phone", "").strip()
    
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400
    
    # Validate international phone format
    if not phone.startswith('+'):
        return jsonify({"error": "Phone number must include country code (e.g., +254729569010)"}), 400
    
    # Remove + and validate digits
    phone_digits = phone[1:]
    if not phone_digits.isdigit() or len(phone_digits) < 7 or len(phone_digits) > 15:
        return jsonify({"error": "Invalid phone number format"}), 400
    
    # Check if phone is already used
    existing = User.query.filter(User.phone == phone, User.id != user.id).first()
    if existing:
        return jsonify({"error": "This phone number is already registered"}), 409
    
    # Generate OTP
    otp = str(random.randint(100000, 999999))
    expiry = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    
    # Store OTP temporarily
    user.verification_token = f"phone_otp:{otp}:{expiry}"
    db.session.commit()
    
    # Format phone for display
    display_phone = phone[:4] + '*' * (len(phone) - 8) + phone[-4:] if len(phone) > 8 else phone
    
    return jsonify({
        "message": f"OTP sent to {display_phone}",
        "phone": phone,
        "otp": otp if os.getenv("FLASK_ENV") == "development" else None
    })


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    return jsonify({"access_token": create_access_token(identity=user_id)})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())