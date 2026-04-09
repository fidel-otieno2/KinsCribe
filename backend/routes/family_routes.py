from flask import Blueprint, request, jsonify
from extensions import db, mail
from models.family import Family
from models.user import User
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_mail import Message

family_bp = Blueprint("family", __name__)


def current_user():
    return User.query.get(int(get_jwt_identity()))


@family_bp.route("/create", methods=["POST"])
@jwt_required()
def create_family():
    user = current_user()
    if user.family_id:
        return jsonify({"error": "You already belong to a family"}), 400

    data = request.json
    family = Family(
        name=data["name"],
        description=data.get("description", ""),
        invite_code=Family.generate_invite_code()
    )
    db.session.add(family)
    db.session.flush()

    user.family_id = family.id
    user.role = "admin"
    db.session.commit()

    return jsonify({"family": family.to_dict()}), 201


@family_bp.route("/join", methods=["POST"])
@jwt_required()
def join_family():
    user = current_user()
    if user.family_id:
        return jsonify({"error": "You already belong to a family"}), 400

    code = request.json.get("invite_code")
    family = Family.query.filter_by(invite_code=code).first()
    if not family:
        return jsonify({"error": "Invalid invite code"}), 404

    user.family_id = family.id
    db.session.commit()
    return jsonify({"message": f"Joined {family.name}", "family": family.to_dict()})


@family_bp.route("/invite/email", methods=["POST"])
@jwt_required()
def invite_by_email():
    user = current_user()
    if user.role != "admin":
        return jsonify({"error": "Only admins can send invites"}), 403

    family = Family.query.get(user.family_id)
    email = request.json.get("email")

    try:
        msg = Message("You're invited to join KinsCribe", recipients=[email])
        msg.body = (
            f"You've been invited to join the '{family.name}' family on KinsCribe.\n\n"
            f"Use this invite code: {family.invite_code}\n"
        )
        mail.send(msg)
        return jsonify({"message": f"Invite sent to {email}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@family_bp.route("/my-family", methods=["GET"])
@jwt_required()
def my_family():
    user = current_user()
    if not user.family_id:
        return jsonify({"error": "You are not in a family yet"}), 404

    family = Family.query.get(user.family_id)
    members = [m.to_dict() for m in family.members]
    return jsonify({"family": family.to_dict(), "members": members})


@family_bp.route("/members/<int:member_id>/role", methods=["PATCH"])
@jwt_required()
def update_member_role(member_id):
    admin = current_user()
    if admin.role != "admin":
        return jsonify({"error": "Admins only"}), 403

    member = User.query.get(member_id)
    if not member or member.family_id != admin.family_id:
        return jsonify({"error": "Member not found in your family"}), 404

    member.role = request.json.get("role", "member")
    db.session.commit()
    return jsonify({"message": "Role updated", "user": member.to_dict()})


@family_bp.route("/members/<int:member_id>", methods=["DELETE"])
@jwt_required()
def remove_member(member_id):
    admin = current_user()
    if admin.role != "admin":
        return jsonify({"error": "Admins only"}), 403

    member = User.query.get(member_id)
    if not member or member.family_id != admin.family_id:
        return jsonify({"error": "Member not found"}), 404

    member.family_id = None
    member.role = "member"
    db.session.commit()
    return jsonify({"message": "Member removed"})
