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

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already registered"}), 409

    if User.query.filter_by(username=data.get("username")).first():
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
    """Receive Google ID token from mobile, verify and sign in/up."""
    from google.oauth2 import id_token
    from google.auth.transport import requests as grequests

    credential = request.json.get("id_token")
    try:
        info = id_token.verify_oauth2_token(
            credential,
            grequests.Request(),
            os.getenv("GOOGLE_CLIENT_ID")
        )
    except Exception:
        return jsonify({"error": "Invalid Google token"}), 401

    google_id = info["sub"]
    email = info["email"]
    name = info.get("name", "")
    avatar_url = info.get("picture", "")

    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_id
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

    return jsonify(_tokens(user))


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

    if not user or not user.password:
        return jsonify({"error": "Invalid credentials"}), 401
    if not bcrypt.check_password_hash(user.password, data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401
    # if not user.is_verified:
    #     return jsonify({"error": "Please verify your email first"}), 403

    return jsonify(_tokens(user))


@auth_bp.route("/avatar", methods=["POST"])
@jwt_required()
def upload_avatar():
    user = User.query.get(int(get_jwt_identity()))
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    result = cloudinary.uploader.upload(
        request.files["file"],
        folder="kinscribe/avatars",
        transformation=[{"width": 300, "height": 300, "crop": "fill", "gravity": "face"}]
    )
    user.avatar_url = result["secure_url"]
    db.session.commit()
    return jsonify({"avatar_url": user.avatar_url, "user": user.to_dict()})


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    return jsonify({"access_token": create_access_token(identity=user_id)})


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    return jsonify(user.to_dict())
