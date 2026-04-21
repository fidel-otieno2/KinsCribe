from flask import Blueprint, request, jsonify
from extensions import db, bcrypt, mail
from models.user import User
from models.notifications import UserSession
from services.sms_service import sms_service
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity, get_jwt
from flask_mail import Message
import secrets
import hashlib
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


def _record_session(user_id, access_token):
    """Record a login session with device/IP info."""
    try:
        token_hash = hashlib.sha256(access_token.encode()).hexdigest()
        ua = request.headers.get('User-Agent', '')
        ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()

        # Detect platform from User-Agent
        ua_lower = ua.lower()
        if 'iphone' in ua_lower or 'ipad' in ua_lower:
            platform = 'ios'
            device_name = 'iPhone' if 'iphone' in ua_lower else 'iPad'
        elif 'android' in ua_lower:
            platform = 'android'
            device_name = 'Android Device'
        elif 'expo' in ua_lower or 'okhttp' in ua_lower:
            platform = 'android'
            device_name = 'Mobile App'
        elif 'chrome' in ua_lower:
            platform = 'web'
            device_name = 'Chrome Browser'
        elif 'safari' in ua_lower:
            platform = 'web'
            device_name = 'Safari Browser'
        elif 'firefox' in ua_lower:
            platform = 'web'
            device_name = 'Firefox Browser'
        else:
            platform = 'unknown'
            device_name = ua[:60] if ua else 'Unknown Device'

        # Check if session with same token_hash already exists
        existing = UserSession.query.filter_by(token_hash=token_hash).first()
        if existing:
            existing.last_active = datetime.utcnow()
            db.session.commit()
            return

        session = UserSession(
            user_id=user_id,
            token_hash=token_hash,
            device_name=device_name,
            platform=platform,
            ip_address=ip,
        )
        db.session.add(session)
        # Keep only last 10 sessions per user
        old_sessions = UserSession.query.filter_by(
            user_id=user_id, is_revoked=False
        ).order_by(UserSession.created_at.desc()).offset(10).all()
        for s in old_sessions:
            db.session.delete(s)
        db.session.commit()
    except Exception as e:
        print(f'Session record error: {e}')
        try:
            db.session.rollback()
        except Exception:
            pass


from datetime import datetime


def _send_email(subject, recipients, html):
    """Send email with proper sender configuration"""
    try:
        sender_email = os.getenv('MAIL_USERNAME')
        sender_name  = os.getenv('MAIL_FROM_NAME', 'KinsCribe')
        msg = Message(
            subject,
            recipients=recipients,
            sender=(sender_name, sender_email)
        )
        msg.html = html
        mail.send(msg)
        return True
    except Exception as e:
        print(f"📧 Email send error: {str(e)}")
        raise e




def _tokens(user):
    access = create_access_token(identity=str(user.id))
    _record_session(user.id, access)
    return {
        "access_token": access,
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
                _send_email(
                    "Verify your KinsCribe account",
                    [email],
                    _otp_email_html(existing_email.name, otp)
                )
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
        # Debug email configuration
        print(f"📧 Registration email config check:")
        print(f"  MAIL_SERVER: {os.getenv('MAIL_SERVER')}")
        print(f"  MAIL_USERNAME: {os.getenv('MAIL_USERNAME')}")
        print(f"  MAIL_DEFAULT_SENDER: {os.getenv('MAIL_DEFAULT_SENDER')}")
        print(f"  MAIL_PASSWORD configured: {'Yes' if os.getenv('MAIL_PASSWORD') else 'No'}")
        
        _send_email(
            "Verify your KinsCribe account",
            [email],
            _otp_email_html(name, otp)
        )
        print(f"📧 Registration email sent successfully!")
        return jsonify({"message": "OTP sent to your email.", "requires_otp": True, "email": email}), 201
    except Exception as e:
        print(f"📧 Registration email failed with error: {str(e)}")
        print(f"📧 Registration email error type: {type(e).__name__}")
        import traceback
        print(f"📧 Registration email full traceback: {traceback.format_exc()}")
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
        _send_email(
            "Your new KinsCribe verification code",
            [user.email],
            f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
          <h2 style="color:#7c3aed">KinsCribe</h2>
          <p>Your new verification code:</p>
          <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#7c3aed">{otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px">Expires in 15 minutes.</p>
        </div>
        """
        )
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
        _send_email(
            "Your KinsCribe password reset code",
            [user.email],
            f"""
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
        )
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

    # If 2FA is enabled, return challenge instead of tokens
    if user.two_factor_enabled:
        return jsonify({"requires_2fa": True, "user_id": user.id})

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
    if "show_activity" in data:
        user.show_activity = bool(data["show_activity"])
    if "allow_dms" in data:
        user.allow_dms = bool(data["allow_dms"])
    if "phone" in data:
        user.phone = data["phone"] or None
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
    import random
    from datetime import datetime, timedelta

    data = request.json or {}
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip().lower()

    if not phone:
        return jsonify({"error": "Phone number is required"}), 400
    if not email:
        return jsonify({"error": "Email is required for phone verification"}), 400
    if not phone.startswith('+'):
        return jsonify({"error": "Phone number must include country code (e.g., +254729569010)"}), 400

    phone_digits = phone[1:]
    if not phone_digits.isdigit() or len(phone_digits) < 7 or len(phone_digits) > 15:
        return jsonify({"error": "Invalid phone number format"}), 400

    otp = str(random.randint(100000, 999999))
    expiry = (datetime.utcnow() + timedelta(minutes=10)).isoformat()

    # Store OTP in DB - find or create user by email
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(
            name="Phone User",
            email=email,
            phone=phone,
            is_verified=False
        )
        db.session.add(user)
    user.verification_token = f"phone_otp:{otp}:{expiry}"
    db.session.commit()

    display_phone = phone[:4] + '*' * (len(phone) - 8) + phone[-4:] if len(phone) > 8 else phone

    try:
        _send_email(
            "Your KinsCribe Phone Verification Code",
            [email],
            f"""
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
          <h2 style="color:#7c3aed;margin-bottom:4px">KinsCribe</h2>
          <p style="color:#94a3b8;margin-top:0">Phone Verification</p>
          <hr style="border-color:#1e293b;margin:20px 0">
          <p>Hi there!</p>
          <p>Use the code below to verify your phone number <strong>{display_phone}</strong>. It expires in <strong>10 minutes</strong>.</p>
          <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
            <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#7c3aed">{otp}</span>
          </div>
          <p style="color:#94a3b8;font-size:13px">If you didn't request this verification, please ignore this email.</p>
        </div>
        """
        )
        return jsonify({"message": f"Verification code sent to {email}", "phone": phone, "email": email, "email_sent": True})
    except Exception as e:
        return jsonify({"message": f"Email service unavailable. OTP: {otp}", "phone": phone, "email": email, "otp": otp, "email_sent": False, "error": str(e)})


@auth_bp.route("/phone/verify-otp", methods=["POST"])
def verify_phone_otp():
    from datetime import datetime
    import traceback

    data = request.json or {}
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()
    name = data.get("name", "").strip()

    print(f"📱 verify_phone_otp called: phone={phone}, email={email}, otp={otp}")

    if not phone or not otp or not email:
        return jsonify({"error": "Phone, email and OTP are required"}), 400

    try:
        user = User.query.filter_by(email=email).first()
        print(f"📱 User found: {user is not None}, token: {user.verification_token if user else 'N/A'}")
        
        if not user:
            return jsonify({"error": "No verification pending for this email"}), 404

        token = user.verification_token or ""
        if not token.startswith("phone_otp:"):
            return jsonify({"error": "No OTP pending. Please request a new code."}), 400

        parts = token.split(":", 2)
        stored_otp = parts[1]
        expiry_str = parts[2]
        print(f"📱 stored_otp={stored_otp}, expiry={expiry_str}, provided={otp}")
        
        if stored_otp != otp:
            return jsonify({"error": "Incorrect OTP"}), 400
        if datetime.utcnow() > datetime.fromisoformat(expiry_str):
            return jsonify({"error": "OTP has expired"}), 400

        is_new_user = user.name == "Phone User"
        if is_new_user and name:
            user.name = name
        user.phone = phone
        user.is_verified = True
        user.verification_token = None
        db.session.commit()

        print(f"📱 Phone verified successfully for {email}")
        return jsonify({**_tokens(user), "is_new_user": is_new_user, "message": "Phone verified successfully!"})

    except Exception as e:
        print(f"📱 verify_phone_otp ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": f"Server error: {str(e)}"}), 500


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
    user = User.query.get(int(get_jwt_identity()))
    data = request.json or {}
    password = data.get("password", "")

    if not user.two_factor_enabled:
        return jsonify({"error": "2FA is not enabled"}), 400

    if user.password and not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "Incorrect password"}), 401

    user.two_factor_enabled = False
    user.two_factor_secret = None
    user.backup_codes = None
    db.session.commit()
    return jsonify({"message": "2FA disabled successfully"})


@auth_bp.route("/2fa/login", methods=["POST"])
def verify_2fa_login():
    """Verify 2FA code or backup code during login"""
    import pyotp
    import json

    data = request.json or {}
    user_id = data.get("user_id")
    code = data.get("code", "").strip()

    if not user_id or not code:
        return jsonify({"error": "user_id and code are required"}), 400

    user = User.query.get(int(user_id))
    if not user or not user.two_factor_enabled:
        return jsonify({"error": "2FA not enabled for this account"}), 400

    # Try TOTP code first
    totp = pyotp.TOTP(user.two_factor_secret)
    if totp.verify(code, valid_window=1):
        return jsonify({**_tokens(user), "message": "2FA verified"})

    # Try backup codes
    try:
        backup_codes = json.loads(user.backup_codes or "[]")
        if code.upper() in backup_codes:
            backup_codes.remove(code.upper())
            user.backup_codes = json.dumps(backup_codes)
            db.session.commit()
            return jsonify({**_tokens(user), "message": "2FA verified with backup code"})
    except Exception:
        pass

    return jsonify({"error": "Invalid code"}), 401
@auth_bp.route("/phone/add", methods=["POST"])
@jwt_required()
def add_phone_number():
    from datetime import datetime

    user = User.query.get(int(get_jwt_identity()))
    data = request.json or {}
    phone = data.get("phone", "").strip()
    otp = data.get("otp", "").strip()

    if not phone or not otp:
        return jsonify({"error": "Phone and OTP are required"}), 400

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

    user.phone = phone
    user.verification_token = None
    db.session.commit()
    return jsonify({"message": "Phone number added successfully", "user": user.to_dict()})


@auth_bp.route("/phone/send-add-otp", methods=["POST"])
@jwt_required()
def send_add_phone_otp():
    import random
    from datetime import datetime, timedelta

    user = User.query.get(int(get_jwt_identity()))
    data = request.json or {}
    phone = data.get("phone", "").strip()

    if not phone:
        return jsonify({"error": "Phone number is required"}), 400
    if not user.email:
        return jsonify({"error": "No email on your account for verification"}), 400
    if not phone.startswith('+'):
        return jsonify({"error": "Phone number must include country code (e.g., +254729569010)"}), 400

    phone_digits = phone[1:]
    if not phone_digits.isdigit() or len(phone_digits) < 7 or len(phone_digits) > 15:
        return jsonify({"error": "Invalid phone number format"}), 400

    otp = str(random.randint(100000, 999999))
    expiry = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
    user.verification_token = f"phone_otp:{otp}:{expiry}"
    db.session.commit()

    display_phone = phone[:4] + '*' * (len(phone) - 8) + phone[-4:] if len(phone) > 8 else phone

    try:
        _send_email(
            "Add Phone Number to KinsCribe",
            [user.email],
            f"""
            <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
              <h2 style="color:#7c3aed;margin-bottom:4px">KinsCribe</h2>
              <p style="color:#94a3b8;margin-top:0">Add Phone Number</p>
              <hr style="border-color:#1e293b;margin:20px 0">
              <p>Hi <strong>{user.name}</strong>!</p>
              <p>Use the code below to add <strong>{display_phone}</strong> to your account. Expires in <strong>10 minutes</strong>.</p>
              <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
                <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#7c3aed">{otp}</span>
              </div>
              <p style="color:#94a3b8;font-size:13px">If you didn't request this, please ignore this email.</p>
            </div>
            """
        )
        return jsonify({"message": f"Verification code sent to {user.email}", "phone": phone, "email_sent": True})
    except Exception as e:
        return jsonify({"message": f"Email service unavailable. OTP: {otp}", "phone": phone, "otp": otp, "email_sent": False, "error": str(e)})


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    import random
    from datetime import datetime, timedelta

    user = User.query.get(int(get_jwt_identity()))
    data = request.json or {}
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")
    otp = data.get("otp", "").strip()

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if user.password:
        if not current_password:
            return jsonify({"error": "Current password is required"}), 400
        if not bcrypt.check_password_hash(user.password, current_password):
            return jsonify({"error": "Current password is incorrect"}), 401
    if not otp:
        code = str(random.randint(100000, 999999))
        expiry = (datetime.utcnow() + timedelta(minutes=10)).isoformat()
        user.verification_token = f"pwd_otp:{code}:{expiry}"
        db.session.commit()
        try:
            _send_email(
                "Confirm Password Change - KinsCribe",
                [user.email],
                f"""
                <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
                  <h2 style="color:#7c3aed;margin-bottom:4px">KinsCribe</h2>
                  <p style="color:#94a3b8;margin-top:0">Password Change Verification</p>
                  <hr style="border-color:#1e293b;margin:20px 0">
                  <p>Hi <strong>{user.name}</strong>,</p>
                  <p>Use the code below to confirm your password change. It expires in <strong>10 minutes</strong>.</p>
                  <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
                    <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#7c3aed">{code}</span>
                  </div>
                  <p style="color:#94a3b8;font-size:13px">If you didn't request this, please ignore this email.</p>
                </div>
                """
            )
            return jsonify({"message": f"Verification code sent to {user.email}", "otp_sent": True})
        except Exception as e:
            return jsonify({"error": f"Failed to send verification email: {str(e)}"}), 500

    # Step 2: OTP provided — verify and change password
    token = user.verification_token or ""
    if not token.startswith("pwd_otp:"):
        return jsonify({"error": "No verification pending. Please request a new code."}), 400
    try:
        _, stored_otp, expiry_str = token.split(":", 2)
        if stored_otp != otp:
            return jsonify({"error": "Incorrect code. Please try again."}), 400
        if datetime.utcnow() > datetime.fromisoformat(expiry_str):
            return jsonify({"error": "Code has expired. Please try again."}), 400
    except Exception:
        return jsonify({"error": "Invalid code"}), 400

    user.password = bcrypt.generate_password_hash(new_password).decode("utf-8")
    user.verification_token = None
    db.session.commit()
    return jsonify({"message": "Password changed successfully"})


@auth_bp.route("/phone/remove", methods=["POST"])
@jwt_required()
def remove_phone():
    user = User.query.get(int(get_jwt_identity()))
    user.phone = None
    db.session.commit()
    return jsonify({"message": "Phone number removed", "user": user.to_dict()})


@auth_bp.route("/test-email", methods=["GET"])
def test_email():
    """Test email configuration"""
    config_info = {
        "MAIL_SERVER": os.getenv('MAIL_SERVER'),
        "MAIL_PORT": os.getenv('MAIL_PORT'),
        "MAIL_USERNAME": os.getenv('MAIL_USERNAME'),
        "MAIL_DEFAULT_SENDER": os.getenv('MAIL_DEFAULT_SENDER'),
        "MAIL_PASSWORD_SET": bool(os.getenv('MAIL_PASSWORD')),
        "MAIL_USE_TLS": os.getenv('MAIL_USE_TLS'),
    }
    
    test_email = request.args.get('to')
    if not test_email:
        return jsonify({"config": config_info, "hint": "Add ?to=youremail@gmail.com to send a test email"})
    
    try:
        msg = Message("KinsCribe Email Test", recipients=[test_email])
        msg.html = "<h2>Email is working!</h2><p>Your KinsCribe email service is configured correctly.</p>"
        mail.send(msg)
        return jsonify({"success": True, "message": f"Test email sent to {test_email}", "config": config_info})
    except Exception as e:
        import traceback
        return jsonify({"success": False, "error": str(e), "traceback": traceback.format_exc(), "config": config_info}), 500


@auth_bp.route("/export-data", methods=["POST"])
@jwt_required()
def export_data():
    """Queue a data export and email the user when ready."""
    from models.social import Post
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        posts = Post.query.filter_by(user_id=user.id).all()
        post_count = len(posts)
    except Exception:
        post_count = 0

    try:
        _send_email(
            "Your KinsCribe Data Export",
            [user.email],
            f"""
            <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
              <h2 style="color:#3b82f6;margin-bottom:4px">KinsCribe</h2>
              <p style="color:#94a3b8;margin-top:0">Data Export</p>
              <hr style="border-color:#1e293b;margin:20px 0">
              <p>Hi <strong>{user.name}</strong>,</p>
              <p>Here is a summary of your KinsCribe account data:</p>
              <div style="background:#1e293b;border-radius:12px;padding:20px;margin:20px 0">
                <table style="width:100%;border-collapse:collapse;color:#f1f5f9;font-size:14px">
                  <tr><td style="padding:8px 0;color:#94a3b8">Name</td><td style="padding:8px 0;font-weight:700">{user.name}</td></tr>
                  <tr><td style="padding:8px 0;color:#94a3b8">Username</td><td style="padding:8px 0">@{user.username or 'not set'}</td></tr>
                  <tr><td style="padding:8px 0;color:#94a3b8">Email</td><td style="padding:8px 0">{user.email}</td></tr>
                  <tr><td style="padding:8px 0;color:#94a3b8">Phone</td><td style="padding:8px 0">{user.phone or 'not added'}</td></tr>
                  <tr><td style="padding:8px 0;color:#94a3b8">Account type</td><td style="padding:8px 0">{'Private' if user.is_private else 'Public'}</td></tr>
                  <tr><td style="padding:8px 0;color:#94a3b8">Posts</td><td style="padding:8px 0">{post_count}</td></tr>
                  <tr><td style="padding:8px 0;color:#94a3b8">Member since</td><td style="padding:8px 0">{user.created_at.strftime('%B %d, %Y') if hasattr(user, 'created_at') and user.created_at else 'N/A'}</td></tr>
                </table>
              </div>
              <p style="color:#94a3b8;font-size:13px">A full export including all media and messages will be available in a future update. This summary was generated on {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}.</p>
              <p style="color:#64748b;font-size:12px">If you didn't request this export, please contact kinscribe3@gmail.com</p>
            </div>
            """
        )
        return jsonify({"message": "Data export emailed successfully"})
    except Exception as e:
        return jsonify({"error": f"Failed to send export email: {str(e)}"}), 500


@auth_bp.route("/u/<username>", methods=["GET"])
def public_profile(username):
    """Public web profile page — shareable HTTPS link like Instagram."""
    user = User.query.filter_by(username=username).first()
    if not user:
        return f"<html><body style='font-family:sans-serif;background:#1C1A14;color:#F5F0E8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'><div style='text-align:center'><h2>Profile not found</h2><p style='color:#A89070'>@{username} doesn't exist on KinsCribe.</p></div></body></html>", 404

    ref = request.args.get('ref', '')
    avatar = user.avatar_url or ''
    bio = user.bio or 'KinsCribe member'
    name = user.name or username
    app_link = f"kinscribe://profile/{user.id}"
    store_link = "https://kinscribe-1.onrender.com"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>{name} (@{username}) · KinsCribe</title>
      <meta name="description" content="{bio}">
      <meta property="og:title" content="{name} (@{username}) · KinsCribe">
      <meta property="og:description" content="{bio}">
      <meta property="og:image" content="{avatar}">
      <meta property="og:url" content="https://kinscribe-1.onrender.com/api/auth/u/{username}">
      <meta name="twitter:card" content="summary">
      <style>
        *{{box-sizing:border-box;margin:0;padding:0}}
        body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#1C1A14;color:#F5F0E8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}}
        .card{{background:#2A2720;border-radius:24px;padding:36px 28px;max-width:380px;width:100%;text-align:center;border:1px solid rgba(196,163,90,0.15)}}
        .avatar{{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #4A7C3F;margin-bottom:16px}}
        .avatar-placeholder{{width:96px;height:96px;border-radius:50%;background:#4A7C3F;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800;color:#fff;margin:0 auto 16px}}
        h1{{font-size:22px;font-weight:800;margin-bottom:4px}}
        .handle{{color:#A89070;font-size:14px;margin-bottom:12px}}
        .bio{{color:#E8E0CC;font-size:14px;line-height:1.5;margin-bottom:24px}}
        .btn{{display:block;background:#4A7C3F;color:#fff;text-decoration:none;padding:14px 24px;border-radius:50px;font-weight:700;font-size:15px;margin-bottom:12px}}
        .btn-outline{{background:transparent;border:1px solid rgba(196,163,90,0.3);color:#C4A35A}}
        .logo{{color:#A89070;font-size:12px;margin-top:20px}}
        .logo span{{color:#4A7C3F;font-weight:700}}
      </style>
      <script>
        // Try to open the app immediately
        window.location.href = "{app_link}";
        setTimeout(function(){{ }}, 2000);
      </script>
    </head>
    <body>
      <div class="card">
        {'<img class="avatar" src="' + avatar + '" alt="' + name + '">' if avatar else '<div class="avatar-placeholder">' + name[0].upper() + '</div>'}
        <h1>{name}</h1>
        <p class="handle">@{username}</p>
        <p class="bio">{bio}</p>
        <a href="{app_link}" class="btn">Open in KinsCribe</a>
        <a href="{store_link}" class="btn btn-outline">Download KinsCribe</a>
        <p class="logo">Shared via <span>KinsCribe</span></p>
      </div>
    </body>
    </html>
    """
    return html, 200, {{'Content-Type': 'text/html'}}


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


@auth_bp.route("/sessions", methods=["GET"])
@jwt_required()
def get_sessions():
    """Return all active sessions for the current user."""
    user_id = int(get_jwt_identity())
    # Get current token hash from Authorization header
    auth_header = request.headers.get('Authorization', '')
    current_token = auth_header.replace('Bearer ', '').strip()
    current_hash = hashlib.sha256(current_token.encode()).hexdigest() if current_token else None

    try:
        sessions = UserSession.query.filter_by(
            user_id=user_id, is_revoked=False
        ).order_by(UserSession.last_active.desc()).all()
        return jsonify({
            "sessions": [s.to_dict(current_hash) for s in sessions],
            "count": len(sessions)
        })
    except Exception:
        # Table may not exist yet
        try:
            db.create_all()
        except Exception:
            pass
        return jsonify({"sessions": [], "count": 0})


@auth_bp.route("/sessions/<int:session_id>", methods=["DELETE"])
@jwt_required()
def revoke_session(session_id):
    """Revoke a specific session (sign out that device)."""
    user_id = int(get_jwt_identity())
    session = UserSession.query.filter_by(id=session_id, user_id=user_id).first()
    if not session:
        return jsonify({"error": "Session not found"}), 404
    session.is_revoked = True
    db.session.commit()
    return jsonify({"message": "Session revoked"})


@auth_bp.route("/sessions/all", methods=["DELETE"])
@jwt_required()
def revoke_all_other_sessions():
    """Revoke all sessions except the current one."""
    user_id = int(get_jwt_identity())
    auth_header = request.headers.get('Authorization', '')
    current_token = auth_header.replace('Bearer ', '').strip()
    current_hash = hashlib.sha256(current_token.encode()).hexdigest() if current_token else None

    try:
        query = UserSession.query.filter_by(user_id=user_id, is_revoked=False)
        if current_hash:
            query = query.filter(UserSession.token_hash != current_hash)
        count = query.count()
        query.update({"is_revoked": True})
        db.session.commit()
        return jsonify({"message": f"Revoked {count} session(s)"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
