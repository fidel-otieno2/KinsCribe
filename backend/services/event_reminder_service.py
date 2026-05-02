from datetime import datetime, timedelta
from extensions import db
from models.extras import FamilyEvent
from models.family import FamilyMember
from models.notifications import Notification
import json


def send_event_reminders():
    """Check for events happening soon and send reminders to family members"""
    now = datetime.utcnow()
    
    # Check for events in the next hour
    upcoming_window = now + timedelta(hours=1)
    
    # Find events that are about to start
    events = FamilyEvent.query.filter(
        FamilyEvent.event_date >= now,
        FamilyEvent.event_date <= upcoming_window
    ).all()
    
    for event in events:
        # Check if reminder already sent (within last 2 hours)
        recent_reminders = Notification.query.filter(
            Notification.type == "event_reminder",
            Notification.created_at >= now - timedelta(hours=2)
        ).filter(
            Notification.data.like(f'%"event_id": {event.id}%')
        ).first()
        
        if recent_reminders:
            continue  # Already sent reminder
        
        # Get all family members
        members = FamilyMember.query.filter_by(family_id=event.family_id).all()
        
        # Calculate time until event
        time_diff = event.event_date - now
        minutes_until = int(time_diff.total_seconds() / 60)
        
        if minutes_until <= 0:
            time_msg = "happening now!"
        elif minutes_until < 60:
            time_msg = f"in {minutes_until} minutes"
        else:
            time_msg = f"in {int(minutes_until/60)} hour(s)"
        
        # Send reminder to all family members
        for member in members:
            notif = Notification(
                user_id=member.user_id,
                from_user_id=event.created_by,
                type="event_reminder",
                title=f"🔔 Reminder: {event.title}",
                message=f"{event.event_type.capitalize()} {time_msg}",
                data=json.dumps({
                    "event_id": event.id,
                    "event_type": event.event_type,
                    "event_date": event.event_date.isoformat(),
                    "title": event.title,
                    "minutes_until": minutes_until
                })
            )
            db.session.add(notif)
        
        db.session.commit()


def check_daily_events():
    """Send daily digest of today's events"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # Find all events happening today
    events = FamilyEvent.query.filter(
        FamilyEvent.event_date >= today_start,
        FamilyEvent.event_date < today_end
    ).all()
    
    # Group by family
    family_events = {}
    for event in events:
        if event.family_id not in family_events:
            family_events[event.family_id] = []
        family_events[event.family_id].append(event)
    
    # Send digest to each family
    for family_id, events_list in family_events.items():
        members = FamilyMember.query.filter_by(family_id=family_id).all()
        
        event_titles = [e.title for e in events_list[:3]]
        if len(events_list) > 3:
            event_titles.append(f"and {len(events_list) - 3} more")
        
        for member in members:
            notif = Notification(
                user_id=member.user_id,
                from_user_id=None,
                type="daily_events",
                title=f"📅 Today's Events ({len(events_list)})",
                message=", ".join(event_titles),
                data=json.dumps({
                    "event_ids": [e.id for e in events_list],
                    "date": today_start.isoformat()
                })
            )
            db.session.add(notif)
    
    db.session.commit()
