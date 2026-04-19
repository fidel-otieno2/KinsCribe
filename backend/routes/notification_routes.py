from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.notifications import Notification, NotificationSettings, DeviceToken
from models.user import User
import json
from datetime import datetime, timedelta

notification_bp = Blueprint("notifications", __name__)


@notification_bp.route("/", methods=["GET"])
@jwt_required()
def get_notifications():
    """Get user's notifications with pagination"""
    user_id = int(get_jwt_identity())
    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 50)
    unread_only = request.args.get("unread_only", "false").lower() == "true"
    
    query = Notification.query.filter_by(user_id=user_id)
    
    if unread_only:
        query = query.filter_by(is_read=False)
    
    notifications = query.order_by(Notification.created_at.desc())\
                         .offset((page - 1) * limit)\
                         .limit(limit)\
                         .all()
    
    # Get unread count
    unread_count = Notification.query.filter_by(user_id=user_id, is_read=False).count()
    
    return jsonify({
        "notifications": [n.to_dict() for n in notifications],
        "unread_count": unread_count,
        "page": page,
        "has_more": len(notifications) == limit
    })


@notification_bp.route("/mark-read", methods=["POST"])
@jwt_required()
def mark_notifications_read():
    """Mark notifications as read"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    notification_ids = data.get("notification_ids", [])
    mark_all = data.get("mark_all", False)
    
    if mark_all:
        Notification.query.filter_by(user_id=user_id, is_read=False)\
                         .update({"is_read": True})
    elif notification_ids:
        Notification.query.filter(
            Notification.user_id == user_id,
            Notification.id.in_(notification_ids)
        ).update({"is_read": True}, synchronize_session=False)
    
    db.session.commit()
    
    # Return updated unread count
    unread_count = Notification.query.filter_by(user_id=user_id, is_read=False).count()
    
    return jsonify({
        "message": "Notifications marked as read",
        "unread_count": unread_count
    })


@notification_bp.route("/settings", methods=["GET"])
@jwt_required()
def get_notification_settings():
    """Get user's notification settings"""
    user_id = int(get_jwt_identity())
    
    settings = NotificationSettings.query.filter_by(user_id=user_id).first()
    if not settings:
        # Create default settings
        settings = NotificationSettings(user_id=user_id)
        db.session.add(settings)
        db.session.commit()
    
    return jsonify(settings.to_dict())


@notification_bp.route("/settings", methods=["PUT"])
@jwt_required()
def update_notification_settings():
    """Update user's notification settings"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    settings = NotificationSettings.query.filter_by(user_id=user_id).first()
    if not settings:
        settings = NotificationSettings(user_id=user_id)
        db.session.add(settings)
    
    # Update settings
    for key in ["likes", "comments", "mentions", "follows", "messages", 
                "stories", "birthdays", "quiet_hours_enabled", "email_digest"]:
        if key in data:
            setattr(settings, key, data[key])
    
    if "quiet_start" in data:
        settings.quiet_start = data["quiet_start"]
    if "quiet_end" in data:
        settings.quiet_end = data["quiet_end"]
    
    settings.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({
        "message": "Notification settings updated",
        "settings": settings.to_dict()
    })


@notification_bp.route("/device-token", methods=["POST"])
@jwt_required()
def register_device_token():
    """Register device token for push notifications"""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    token = data.get("token")
    platform = data.get("platform", "unknown")
    device_name = data.get("device_name")
    
    if not token:
        return jsonify({"error": "Token is required"}), 400
    
    # Check if token already exists
    existing = DeviceToken.query.filter_by(user_id=user_id, token=token).first()
    if existing:
        existing.last_used = datetime.utcnow()
        existing.is_active = True
        if device_name:
            existing.device_name = device_name
    else:
        device_token = DeviceToken(
            user_id=user_id,
            token=token,
            platform=platform,
            device_name=device_name
        )
        db.session.add(device_token)
    
    db.session.commit()
    
    return jsonify({"message": "Device token registered successfully"})


@notification_bp.route("/device-tokens", methods=["GET"])
@jwt_required()
def get_device_tokens():
    """Get user's registered device tokens"""
    user_id = int(get_jwt_identity())
    
    tokens = DeviceToken.query.filter_by(user_id=user_id, is_active=True)\
                             .order_by(DeviceToken.last_used.desc())\
                             .all()
    
    return jsonify({
        "tokens": [t.to_dict() for t in tokens]
    })


@notification_bp.route("/device-token/<int:token_id>", methods=["DELETE"])
@jwt_required()
def remove_device_token(token_id):
    """Remove/deactivate a device token"""
    user_id = int(get_jwt_identity())
    
    token = DeviceToken.query.filter_by(id=token_id, user_id=user_id).first()
    if not token:
        return jsonify({"error": "Token not found"}), 404
    
    token.is_active = False
    db.session.commit()
    
    return jsonify({"message": "Device token removed"})


@notification_bp.route("/test", methods=["POST"])
@jwt_required()
def send_test_notification():
    """Send a test notification (for development)"""
    user_id = int(get_jwt_identity())
    
    notification = Notification(
        user_id=user_id,
        type="test",
        title="Test Notification",
        message="This is a test notification from KinsCribe!",
        data=json.dumps({"test": True})
    )
    
    db.session.add(notification)
    db.session.commit()
    
    return jsonify({
        "message": "Test notification sent",
        "notification": notification.to_dict()
    })


def create_notification(user_id, notification_type, title, message, from_user_id=None, data=None):
    """Helper function to create notifications"""
    try:
        # Check if user has this notification type enabled
        settings = NotificationSettings.query.filter_by(user_id=user_id).first()
        if settings:
            type_enabled = getattr(settings, notification_type, True)
            if not type_enabled:
                return None
        
        # Check quiet hours
        if settings and settings.quiet_hours_enabled:
            now = datetime.now().time()
            quiet_start = datetime.strptime(settings.quiet_start, "%H:%M").time()
            quiet_end = datetime.strptime(settings.quiet_end, "%H:%M").time()
            
            if quiet_start <= quiet_end:
                # Same day quiet hours
                if quiet_start <= now <= quiet_end:
                    return None
            else:
                # Overnight quiet hours
                if now >= quiet_start or now <= quiet_end:
                    return None
        
        notification = Notification(
            user_id=user_id,
            from_user_id=from_user_id,
            type=notification_type,
            title=title,
            message=message,
            data=json.dumps(data) if data else None
        )
        
        db.session.add(notification)
        db.session.commit()
        
        return notification
        
    except Exception as e:
        print(f"Error creating notification: {e}")
        return None