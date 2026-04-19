from flask import Blueprint, request, jsonify
from extensions import db, bcrypt, mail
from models.user import User
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from flask_mail import Message
import secrets
import cloudinary
import cloudinary.uploader
import os

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
    data = request.json

    existing = User.query.filter_by(email=data["email"]).first()
    if existing:
        if existing.google_id and not existing.password:
            return jsonify({"error": "This email is linked to a Google account. Please sign in with Google."}), 409
        return jsonify({"error": "Email already registered"}), 409

    if data.get("username") and User.query.filter_by(username=data.get("username")).first():
        return jsonify({"error": "Username already taken"}), 409

    token = secrets.token_urlsafe(32)
    user = User(
        name=data["name"],
        username=data.get("username"),
        email=data["email"],
        password=bcrypt.generate_password_hash(data["password"]).decode("utf-8"),
        verification_token=token
    )
    db.session.add(user)
    db.session.commit()

    try:
        msg = Message("Verify your KinsCribe account", recipients=[user.email])
        msg.body = f"Click to verify: http://localhost:3000/verify/{token}"
        mail.send(msg)
        return jsonify({"message": "Registered. Check your email to verify."}), 201
    except Exception:
        # Email not configured — still allow registration, mark verified for dev
        user.is_verified = True
        db.session.commit()
        return jsonify({"message": "Registered successfully."}), 201


@auth_bp.route("/google", methods=["POST"])
def google_auth():
    """Accept Google access token from expo-auth-session, fetch user info and sign in/up."""
    import requests as http_requests

    data = request.json or {}
    access_token = data.get("id_token")

    if not access_token:
        return jsonify({"error": "No token provided"}), 400

    try:
        resp = http_requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )
        if resp.status_code != 200:
            return jsonify({"error": "Invalid Google token"}), 401
        info = resp.json()
        google_id = info.get("sub")
        email = info.get("email")
        name = info.get("name", "")
        avatar_url = info.get("picture", "")
    except Exception as e:
        return jsonify({"error": f"Token verification failed: {str(e)}"}), 401

    if not email:
        return jsonify({"error": "Could not retrieve email from Google"}), 401

    user = User.query.filter_by(google_id=google_id).first() if google_id else None
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            # Merge: link Google ID to existing manual account
            if google_id and not user.google_id:
                user.google_id = google_id
            if not user.avatar_url and avatar_url:
                user.avatar_url = avatar_url
        else:
            # Brand new user via Google
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
    if not username or len(username) < 3:
        return jsonify({"available": False, "error": "Too short"})
    if not username.replace('_', '').replace('.', '').isalnum():
        return jsonify({"available": False, "error": "Only letters, numbers, _ and . allowed"})
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
