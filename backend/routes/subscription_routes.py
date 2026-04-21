from flask import Blueprint, request, jsonify
from extensions import db
from models.user import User
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta

subscription_bp = Blueprint("subscription", __name__)

PLANS = {
    "monthly": {"label": "Monthly", "price": 4.99, "duration_days": 30},
    "yearly":  {"label": "Yearly",  "price": 39.99, "duration_days": 365},
}

PREMIUM_FEATURES = [
    "Unlimited post storage",
    "AI story & caption generation",
    "Advanced analytics & insights",
    "Priority customer support",
    "Exclusive profile badge",
    "Ad-free experience",
    "Early access to new features",
]


@subscription_bp.route("/status", methods=["GET"])
@jwt_required()
def get_status():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Auto-expire premium if past expiry date
    if user.is_premium and user.premium_expires_at:
        if datetime.utcnow() > user.premium_expires_at:
            user.is_premium = False
            user.premium_plan = None
            user.premium_expires_at = None
            db.session.commit()

    return jsonify({
        "is_premium": user.is_premium or False,
        "plan": user.premium_plan,
        "expires_at": user.premium_expires_at.isoformat() if user.premium_expires_at else None,
        "plans": PLANS,
        "features": PREMIUM_FEATURES,
    })


@subscription_bp.route("/upgrade", methods=["POST"])
@jwt_required()
def upgrade():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    plan_key = data.get("plan", "monthly")

    if plan_key not in PLANS:
        return jsonify({"error": "Invalid plan. Choose 'monthly' or 'yearly'."}), 400

    plan = PLANS[plan_key]
    now = datetime.utcnow()

    # If already premium on same plan, extend from current expiry
    base = user.premium_expires_at if (user.is_premium and user.premium_expires_at and user.premium_expires_at > now) else now

    user.is_premium = True
    user.premium_plan = plan_key
    user.premium_expires_at = base + timedelta(days=plan["duration_days"])
    db.session.commit()

    # Send confirmation email
    try:
        from routes.auth_routes import _send_email
        expires_str = user.premium_expires_at.strftime("%B %d, %Y")
        _send_email(
            "Welcome to KinsCribe Premium! 🎉",
            [user.email],
            f"""
            <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
              <h2 style="color:#7c3aed;margin-bottom:4px">KinsCribe Premium</h2>
              <p style="color:#94a3b8;margin-top:0">Subscription Confirmed</p>
              <hr style="border-color:#1e293b;margin:20px 0">
              <p>Hi <strong>{user.name}</strong>, welcome to Premium! 🎉</p>
              <p>Your <strong>{plan['label']}</strong> plan is now active.</p>
              <div style="background:#1e293b;border-radius:12px;padding:20px;margin:20px 0">
                <p style="margin:0 0 12px;color:#a78bfa;font-weight:700">What you get:</p>
                {"".join(f'<p style="margin:6px 0;color:#f1f5f9">✅ {f}</p>' for f in PREMIUM_FEATURES)}
              </div>
              <p style="color:#94a3b8;font-size:13px">Your plan renews on <strong style="color:#f1f5f9">{expires_str}</strong>.</p>
              <p style="color:#64748b;font-size:12px">Questions? Contact support@kinscribe.com</p>
            </div>
            """
        )
    except Exception as e:
        print(f"Subscription email error: {e}")

    return jsonify({
        "message": f"Upgraded to {plan['label']} Premium successfully!",
        "is_premium": True,
        "plan": plan_key,
        "expires_at": user.premium_expires_at.isoformat(),
        "user": user.to_dict(),
    })


@subscription_bp.route("/cancel", methods=["POST"])
@jwt_required()
def cancel():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.is_premium:
        return jsonify({"error": "No active premium subscription"}), 400

    expires_str = user.premium_expires_at.strftime("%B %d, %Y") if user.premium_expires_at else "immediately"

    # Keep premium active until expiry — just mark as cancelled
    # We set is_premium=False immediately for simplicity (no payment processor)
    user.is_premium = False
    user.premium_plan = None
    user.premium_expires_at = None
    db.session.commit()

    try:
        from routes.auth_routes import _send_email
        _send_email(
            "KinsCribe Premium Cancelled",
            [user.email],
            f"""
            <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:16px">
              <h2 style="color:#7c3aed;margin-bottom:4px">KinsCribe</h2>
              <p style="color:#94a3b8;margin-top:0">Subscription Cancelled</p>
              <hr style="border-color:#1e293b;margin:20px 0">
              <p>Hi <strong>{user.name}</strong>,</p>
              <p>Your Premium subscription has been cancelled. You had access until <strong>{expires_str}</strong>.</p>
              <p style="color:#94a3b8;font-size:13px">You can re-subscribe anytime from Settings → Subscription.</p>
              <p style="color:#64748b;font-size:12px">Questions? Contact support@kinscribe.com</p>
            </div>
            """
        )
    except Exception as e:
        print(f"Cancellation email error: {e}")

    return jsonify({
        "message": "Premium subscription cancelled.",
        "user": user.to_dict(),
    })
