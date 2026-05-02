# Calendar Event Notifications & Reminders

Complete implementation of calendar event notifications and automated reminders for the KinsCribe family calendar system.

## Features Implemented

### 1. Event Creation Notifications
When an admin creates a calendar event, all family members receive an instant notification with:
- Event title and type (Birthday, Anniversary, Event, Milestone, Appointment, Vacation, Meeting)
- Event date and time
- Creator information
- Direct link to Family Calendar

### 2. Event Reminders
Automated reminder system that checks for upcoming events and sends notifications:
- **Timing**: Checks every 15 minutes for events happening within the next hour
- **Smart Reminders**: Shows time until event ("in 30 minutes", "in 1 hour", "happening now!")
- **Deduplication**: Prevents duplicate reminders (won't send again within 2 hours)
- **All Members**: Sends to every family member, not just the creator

### 3. Daily Event Digest
Morning summary of today's events:
- **Timing**: Sent at 8:00 AM daily
- **Content**: Lists all events happening today
- **Grouped**: Shows up to 3 event titles, then "and X more"
- **Family-Specific**: Each family gets their own digest

## Backend Implementation

### Files Created/Modified

#### `/backend/services/event_reminder_service.py`
Core reminder logic:
- `send_event_reminders()` - Checks for events in next hour, sends reminders
- `check_daily_events()` - Sends morning digest of today's events
- Calculates time until event dynamically
- Prevents duplicate notifications

#### `/backend/scheduler.py`
Background task scheduler using APScheduler:
- Runs `send_event_reminders()` every 15 minutes
- Runs `check_daily_events()` daily at 8 AM
- Handles Flask app context properly
- Error logging and graceful shutdown

#### `/backend/routes/extras_routes.py`
Updated `POST /extras/calendar` endpoint:
- Creates event in database
- Sends notification to all family members (except creator)
- Includes event details in notification data
- Returns created event

#### `/backend/routes/notification_routes.py`
Updated notification fetching:
- Added calendar event notifications to `_get_all_notifications()`
- Supports 3 new notification types:
  - `calendar_event` - New event created
  - `event_reminder` - Event starting soon
  - `daily_events` - Today's events digest

#### `/backend/app.py`
Integrated scheduler:
- Starts scheduler on app initialization
- Runs within Flask app context
- Error handling for scheduler failures

#### `/backend/requirements.txt`
Added dependency:
- `APScheduler==3.10.4` - Background task scheduling

## Frontend Implementation

### Files Modified

#### `/mobile/src/screens/NotificationsScreen.js`
Added calendar notification support:
- **New Notification Types**:
  - `calendar_event` - Blue calendar icon, "created a calendar event"
  - `event_reminder` - Orange alarm icon, "event reminder"
  - `daily_events` - Green today icon, "today's events"
- **Navigation**: Tapping notification opens Family Calendar
- **Visual Design**: Matches existing notification style with calendar-themed colors

## Notification Types

### Calendar Event (calendar_event)
- **Icon**: 📅 Calendar
- **Color**: Blue (#3b82f6)
- **Trigger**: When admin creates new event
- **Message**: "New [event_type]: [title]"
- **Body**: "[Creator] created a new event on [date at time]"
- **Action**: Opens Family Calendar

### Event Reminder (event_reminder)
- **Icon**: ⏰ Alarm
- **Color**: Orange (#f59e0b)
- **Trigger**: Event starting within 1 hour
- **Message**: "🔔 Reminder: [title]"
- **Body**: "[Event type] in [X] minutes" or "happening now!"
- **Action**: Opens Family Calendar

### Daily Events (daily_events)
- **Icon**: 📆 Today
- **Color**: Green (#10b981)
- **Trigger**: 8:00 AM daily (if events exist)
- **Message**: "📅 Today's Events ([count])"
- **Body**: "[Event 1], [Event 2], [Event 3], and X more"
- **Action**: Opens Family Calendar

## Database Schema

Uses existing `Notification` model with these fields:
- `user_id` - Recipient
- `from_user_id` - Event creator (or NULL for system notifications)
- `type` - Notification type (calendar_event, event_reminder, daily_events)
- `title` - Notification headline
- `message` - Notification body text
- `data` - JSON with event details:
  ```json
  {
    "event_id": 123,
    "event_type": "birthday",
    "event_date": "2024-01-15T14:30:00",
    "title": "Mom's Birthday",
    "minutes_until": 45
  }
  ```

## API Endpoints

### Create Event (with notifications)
```
POST /api/extras/calendar
Authorization: Bearer <token>

Request:
{
  "title": "Family Dinner",
  "description": "Monthly family gathering",
  "event_date": "2024-01-15T18:00:00",
  "event_type": "event",
  "color": "#7c3aed",
  "is_recurring": false
}

Response:
{
  "event": {
    "id": 123,
    "title": "Family Dinner",
    "event_date": "2024-01-15T18:00:00",
    ...
  }
}

Side Effect: Sends notification to all family members
```

### Get Notifications
```
GET /api/notifications/
Authorization: Bearer <token>

Response:
{
  "notifications": [
    {
      "id": "calendar_notif-456",
      "type": "calendar_event",
      "source": "calendar",
      "actor_name": "John Doe",
      "actor_avatar": "https://...",
      "title": "New event: Family Dinner",
      "body": "John Doe created a new event on Jan 15, 2024 at 6:00 PM",
      "data": "{\"event_id\": 123, ...}",
      "created_at": "2024-01-10T10:30:00Z",
      "is_read": false
    }
  ],
  "unread_count": 5
}
```

## Scheduler Configuration

### Event Reminders
- **Frequency**: Every 15 minutes
- **Window**: Events in next 1 hour
- **Deduplication**: 2-hour cooldown per event
- **Job ID**: `event_reminders`

### Daily Digest
- **Frequency**: Daily at 8:00 AM
- **Scope**: Events happening today (midnight to midnight)
- **Job ID**: `daily_events`

## User Flow

### Event Creation Flow
1. Admin opens Family Calendar
2. Admin creates new event with date/time
3. Event saved to database
4. System sends notification to all family members
5. Members see notification badge
6. Members tap notification → opens Family Calendar

### Reminder Flow
1. Scheduler checks every 15 minutes
2. Finds events starting within 1 hour
3. Calculates time until event
4. Sends reminder to all family members
5. Members receive push notification
6. Members tap → opens Family Calendar to see event details

### Daily Digest Flow
1. Scheduler runs at 8:00 AM
2. Finds all events happening today
3. Groups by family
4. Sends digest to each family member
5. Members see morning summary of today's events

## Testing

### Manual Testing
1. **Create Event**: Create event as admin, verify all members get notification
2. **Upcoming Event**: Create event 30 minutes from now, wait for reminder
3. **Daily Digest**: Create event for today, check notification at 8 AM
4. **Navigation**: Tap notification, verify calendar opens
5. **Deduplication**: Verify no duplicate reminders within 2 hours

### Edge Cases Handled
- Events with no family members (skipped)
- Events in the past (ignored)
- Scheduler failures (logged, app continues)
- Invalid event data (caught, logged)
- Concurrent reminder checks (deduplicated)

## Performance Considerations

- **Efficient Queries**: Uses indexed date filters
- **Batch Processing**: Processes all events in single query
- **Deduplication**: Prevents notification spam
- **Background Jobs**: Non-blocking, doesn't affect app performance
- **Error Handling**: Failures don't crash scheduler

## Future Enhancements

Potential improvements:
- [ ] Customizable reminder times (15 min, 1 hour, 1 day before)
- [ ] Snooze reminder functionality
- [ ] Event RSVP tracking
- [ ] Recurring event reminders
- [ ] Push notification support (FCM/APNS)
- [ ] Email reminders for important events
- [ ] SMS reminders via Twilio
- [ ] Timezone support for distributed families
- [ ] Reminder preferences per user
- [ ] Event attendance tracking

## Dependencies

- **APScheduler 3.10.4** - Background task scheduling
- **Flask-SQLAlchemy** - Database ORM
- **Flask-JWT-Extended** - Authentication

## Configuration

No additional configuration required. Scheduler starts automatically when app launches.

To disable scheduler (for testing):
```python
# In app.py, comment out:
# from scheduler import start_scheduler
# start_scheduler(app)
```

## Troubleshooting

### Reminders not sending
- Check scheduler is running: Look for "Event reminder scheduler started" in logs
- Verify events exist in next hour: Query `family_events` table
- Check notification creation: Query `notifications` table

### Duplicate notifications
- Verify deduplication logic in `send_event_reminders()`
- Check 2-hour cooldown window
- Review notification timestamps

### Scheduler not starting
- Check APScheduler installation: `pip install APScheduler==3.10.4`
- Review app startup logs for errors
- Verify Flask app context is available

## Summary

Complete calendar notification system with:
- ✅ Instant notifications when events created
- ✅ Automated reminders for upcoming events
- ✅ Daily morning digest of today's events
- ✅ Smart deduplication to prevent spam
- ✅ Beautiful UI integration in notifications screen
- ✅ Direct navigation to Family Calendar
- ✅ Background scheduler with error handling
- ✅ Scalable architecture for future enhancements
