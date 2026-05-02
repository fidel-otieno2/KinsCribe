# Post-to-Family Notification - Quick Reference

## What Was Implemented

Added automatic notifications when users share posts to family groups.

## Changes Made

### 1. Backend - Post Routes (`/backend/routes/post_routes.py`)
**Endpoint**: `POST /posts/{post_id}/post-to-family`

**Added notification logic**:
```python
# After creating family story, send notifications to all family members
for member in family_members:
    if member.user_id != user.id:  # Don't notify the poster
        notification = Notification(
            user_id=member.user_id,
            from_user_id=user.id,
            type="new_family_story",
            title=f"{user.name} shared a post to {family.name}",
            message=post.caption[:100] if post.caption else "Check out this post!",
            data=json.dumps({
                "story_id": story.id,
                "post_id": post_id,
                "family_id": family_id,
                "family_name": family.name,
                "media_url": post.media_url,
                "media_type": post.media_type,
            })
        )
        db.session.add(notification)
```

### 2. Backend - Notification Routes (`/backend/routes/notification_routes.py`)
**Function**: `_get_all_notifications(user)`

**Added retrieval logic**:
```python
# Get new_family_story notifications from Notification model
family_story_notifs = NotificationModel.query.filter(
    NotificationModel.user_id == user.id,
    NotificationModel.type == 'new_family_story'
).order_by(NotificationModel.created_at.desc()).limit(20).all()

# Parse and format notifications
for notif in family_story_notifs:
    data = json.loads(notif.data) if notif.data else {}
    notifs.append({
        "id": f"family_story_notif-{notif.id}",
        "type": notif.type,
        "source": "family_story",
        "actor_name": notif.from_user.name,
        "title": notif.title,
        "body": notif.message,
        "story_id": data.get("story_id"),
        "post_id": data.get("post_id"),
        # ... more fields
    })
```

## How It Works

### User Flow
1. **User shares post to family**
   - Taps three-dots menu on their post
   - Selects "Post to Family Story"
   - Chooses family group
   - Confirms

2. **System creates notification**
   - Creates family story from post
   - Generates notification for each family member
   - Stores in `Notification` table

3. **Family members receive notification**
   - Notification appears in notifications screen
   - Shows: "{User} shared a post to {Family Name}"
   - Includes post caption preview
   - Displays post media thumbnail

4. **User taps notification**
   - Navigates to story detail screen
   - Can view, like, comment on shared post

## Notification Details

**Type**: `new_family_story`
**Source**: `family_story`
**Title**: "{actor_name} shared a post to {family_name}"
**Body**: First 100 characters of post caption
**Recipients**: All family members except the poster

**Data Included**:
- `story_id` - ID of created family story
- `post_id` - Original post ID
- `family_id` - Family group ID
- `family_name` - Family group name
- `media_url` - Post media URL
- `media_type` - Media type (image/video)

## Testing

### Manual Test Steps
1. Create a post with caption and media
2. Share post to family group
3. Check other family members' notifications
4. Verify notification shows correct info
5. Tap notification → should open story detail
6. Verify unread count updates

### Expected Results
✅ All family members receive notification (except poster)
✅ Notification shows poster's name and family name
✅ Caption preview appears in notification body
✅ Media thumbnail displays
✅ Tapping opens story detail screen
✅ Unread count increments
✅ Mark as read works correctly

## Database Tables Used

1. **Notification** - Stores notification records
   - `user_id` - Recipient
   - `from_user_id` - Poster
   - `type` - "new_family_story"
   - `title` - Notification title
   - `message` - Caption preview
   - `data` - JSON with story/post/family IDs

2. **Story** - Family story created from post
   - `family_id` - Target family
   - `user_id` - Poster
   - `content` - Post caption + marker
   - `media_url` - Post media

3. **FamilyMember** - Used to find recipients
   - `family_id` - Family group
   - `user_id` - Member ID

## API Endpoints

### Create Notification (automatic)
```
POST /posts/{post_id}/post-to-family
Authorization: Bearer {token}
Body: { "family_id": 123 }

→ Creates story + sends notifications
```

### Get Notifications
```
GET /notifications/
Authorization: Bearer {token}

→ Returns all notifications including post-to-family
```

### Mark as Read
```
POST /notifications/mark-read
Authorization: Bearer {token}
Body: { "notification_ids": ["family_story_notif-456"] }

→ Marks notification as read
```

## Files Modified

1. `/backend/routes/post_routes.py` - Added notification creation
2. `/backend/routes/notification_routes.py` - Added notification retrieval

## No Frontend Changes Needed

The mobile app already handles `new_family_story` notifications:
- Icon: People icon (purple)
- Label: "shared a family story"
- Action: Navigate to story detail

## Troubleshooting

**Notifications not appearing?**
- Check user is family member
- Verify notification created in database
- Check notification type is "new_family_story"
- Ensure user is not the poster (no self-notifications)

**Duplicate notifications?**
- Each family member gets one notification per share
- Same post can be shared to multiple families (separate notifications)

**Wrong data in notification?**
- Check `data` field is valid JSON
- Verify story_id, post_id, family_id are correct
- Ensure media_url and media_type are set

---

**Status**: ✅ Implemented and Ready
**Impact**: All family members now get notified when posts are shared to their family group
**Next Steps**: Test with real users and monitor engagement
