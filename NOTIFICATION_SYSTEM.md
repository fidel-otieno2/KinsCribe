# KinsCribe Notification System

## Overview
Comprehensive notification system that keeps users informed about all activities across the platform including posts, family stories, follows, collaborations, and more.

## Notification Types

### 1. **Post Interactions**
#### Post Likes
- **Trigger**: Someone likes your post
- **Type**: `post_like`
- **Source**: `post`
- **Title**: "{actor_name} liked your post"
- **Body**: First 60 characters of post caption
- **Data**: `post_id`, `post_media`

#### Post Comments
- **Trigger**: Someone comments on your post
- **Type**: `post_comment`
- **Source**: `post`
- **Title**: "{actor_name} commented on your post"
- **Body**: Comment text
- **Data**: `post_id`, `post_media`, `comment_text`

#### Post Shares
- **Trigger**: Your post is shared
- **Type**: `post_share`
- **Source**: `post`
- **Title**: "Your post was shared {count} time(s)"
- **Body**: First 60 characters of post caption
- **Data**: `post_id`, `post_media`, `share_count`

---

### 2. **Family Story Interactions**
#### Story Likes
- **Trigger**: Someone likes your family story
- **Type**: `story_like`
- **Source**: `family_story`
- **Title**: "{actor_name} liked your family story"
- **Body**: Story title
- **Data**: `story_id`, `story_title`, `story_media`, `story_media_type`

#### Story Comments
- **Trigger**: Someone comments on your family story
- **Type**: `story_comment`
- **Source**: `family_story`
- **Title**: "{actor_name} commented on your family story"
- **Body**: Comment text
- **Data**: `story_id`, `story_title`, `story_media`, `story_media_type`, `comment_text`

#### New Family Stories
- **Trigger**: Family member shares a new story
- **Type**: `new_family_story`
- **Source**: `family_story`
- **Title**: "{actor_name} shared a family story"
- **Body**: Story title or caption
- **Data**: `story_id`, `story_title`, `story_media`, `story_media_type`

#### Post Shared to Family ✨ NEW
- **Trigger**: Someone shares a post to your family group
- **Type**: `new_family_story`
- **Source**: `family_story`
- **Title**: "{actor_name} shared a post to {family_name}"
- **Body**: First 100 characters of post caption
- **Data**: `story_id`, `post_id`, `family_id`, `family_name`, `media_url`, `media_type`
- **Recipients**: All family members except the poster
- **Location**: `/backend/routes/post_routes.py` - `post_to_family()` endpoint

---

### 3. **Social Connections**
#### New Follower
- **Trigger**: Someone follows you (public account)
- **Type**: `follow`
- **Source**: `follow`
- **Title**: "{actor_name} followed you"
- **Body**: "@{username}"
- **Data**: `actor_id`, `actor_name`, `actor_avatar`

#### Follow Request
- **Trigger**: Someone requests to follow you (private account)
- **Type**: `follow_request`
- **Source**: `follow`
- **Title**: "{actor_name} wants to follow you"
- **Body**: "@{username}"
- **Data**: `connection_id`, `actor_id`, `actor_name`, `actor_avatar`
- **Actions**: Accept / Decline

---

### 4. **Collaboration**
#### Collab Invite
- **Trigger**: Someone invites you to co-create a post
- **Type**: `collab_invite`
- **Source**: `collab`
- **Title**: "{actor_name} invited you to co-create a post"
- **Body**: "Role: {role} · {post_caption}"
- **Data**: `collab_id`, `post_id`, `post_media`, `role`
- **Actions**: Accept / Reject
- **Endpoint**: `/notifications/collab/{collab_id}/respond`

---

### 5. **Family Management**
#### Family Invite
- **Trigger**: Admin/owner invites you to join a family
- **Type**: `family_invite`
- **Source**: `family`
- **Title**: "{actor_name} invited you to join {family_name}"
- **Body**: Family name
- **Data**: `token`, `family_id`, `family_name`, `family_avatar`
- **Actions**: Accept / Decline
- **Endpoints**: 
  - Accept: `/family/invite/{token}/accept`
  - Decline: `/family/invite/{token}/decline`

#### Family Invite Accepted
- **Trigger**: Someone accepts your family invitation
- **Type**: `family_invite_accepted`
- **Source**: `family`
- **Title**: "{actor_name} accepted your family invitation!"
- **Body**: "{actor_name} has joined {family_name}"
- **Data**: `family_id`

---

### 6. **Calendar & Events**
#### Birthday Reminders
- **Trigger**: Family member's birthday is within 7 days
- **Type**: `birthday`
- **Source**: `family`
- **Title**: "🎂 {event_title}"
- **Body**: "Today!" or "In {days} day(s)"
- **Actor**: "KinsCribe" (system notification)

#### Calendar Events
- **Trigger**: Event reminder or daily events summary
- **Type**: `calendar_event`, `event_reminder`, `daily_events`
- **Source**: `calendar`
- **Title**: Event-specific title
- **Body**: Event details
- **Data**: Event-specific data

---

### 7. **Mentions**
#### User Mentions
- **Trigger**: Someone mentions you in a post or comment
- **Type**: `mention`
- **Source**: Varies (post, comment, story)
- **Title**: "{actor_name} mentioned you"
- **Body**: Content excerpt
- **Storage**: In-memory store `_mention_store`

---

## Implementation Details

### Backend Architecture

#### Notification Storage
1. **Database Model** (`models/notifications.py`):
   - `Notification` table for persistent notifications
   - Fields: `user_id`, `from_user_id`, `type`, `title`, `message`, `data`, `created_at`

2. **In-Memory Store**:
   - `_mention_store` for mention notifications
   - Format: `{ user_id: [notif_dict, ...] }`

3. **Read Receipts**:
   - `NotificationReadReceipt` table tracks read status
   - Fields: `user_id`, `notification_key`

#### Notification Aggregation
Function: `_get_all_notifications(user)` in `/backend/routes/notification_routes.py`

**Sources**:
1. Story likes & comments (from `StoryLike`, `StoryComment` tables)
2. New family stories (from `Story` table)
3. Post likes & comments (from `PostLike`, `PostComment` tables)
4. New followers / follow requests (from `Connection` table)
5. Birthday reminders (from `FamilyEvent` table)
6. Post shares (from `Post.share_count`)
7. Mentions (from in-memory store)
8. Calendar events (from `Notification` table)
9. Collab invites (from `PostCollaborator` table)
10. Family invites (from `FamilyInvite` table)
11. **NEW**: Post-to-family notifications (from `Notification` table)

### API Endpoints

#### Get All Notifications
```
GET /notifications/
Authorization: Bearer {token}

Response:
{
  "notifications": [
    {
      "id": "post_like-123",
      "type": "post_like",
      "source": "post",
      "actor_name": "John Doe",
      "actor_avatar": "https://...",
      "actor_id": 456,
      "title": "John Doe liked your post",
      "body": "Amazing photo!",
      "post_id": 789,
      "post_media": "https://...",
      "created_at": "2024-01-15T10:30:00Z",
      "is_read": false
    },
    ...
  ],
  "unread_count": 5
}
```

#### Get Unread Count
```
GET /notifications/count
Authorization: Bearer {token}

Response:
{
  "unread_count": 5
}
```

#### Mark as Read
```
POST /notifications/mark-read
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "mark_all": true  // OR
  "notification_ids": ["post_like-123", "follow-456"]
}

Response:
{
  "message": "Marked as read",
  "unread_count": 0
}
```

#### Respond to Collab Invite
```
POST /notifications/collab/{collab_id}/respond
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "action": "accept"  // or "reject"
}

Response:
{
  "status": "accepted"
}
```

---

## Post-to-Family Notification Flow

### Trigger Point
**File**: `/backend/routes/post_routes.py`
**Endpoint**: `POST /posts/{post_id}/post-to-family`

### Implementation
```python
# After creating the family story
db.session.flush()

# Send notifications to all family members except the poster
from models.notifications import Notification
from models.family import Family

family = Family.query.get(family_id)
family_members = FamilyMember.query.filter_by(family_id=family_id).all()

for member in family_members:
    if member.user_id != user.id:  # Don't notify the person who posted
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

db.session.commit()
```

### Notification Retrieval
**File**: `/backend/routes/notification_routes.py`
**Function**: `_get_all_notifications(user)`

```python
# Get new_family_story notifications from Notification model
family_story_notifs = NotificationModel.query.filter(
    NotificationModel.user_id == user.id,
    NotificationModel.type == 'new_family_story'
).order_by(NotificationModel.created_at.desc()).limit(20).all()

for notif in family_story_notifs:
    data = json.loads(notif.data) if notif.data else {}
    notifs.append({
        "id": f"family_story_notif-{notif.id}",
        "type": notif.type,
        "source": "family_story",
        "actor_name": notif.from_user.name if notif.from_user else "Someone",
        "actor_avatar": notif.from_user.avatar_url if notif.from_user else None,
        "actor_id": notif.from_user_id,
        "title": notif.title,
        "body": notif.message,
        "story_id": data.get("story_id"),
        "post_id": data.get("post_id"),
        "family_id": data.get("family_id"),
        "story_media": data.get("media_url"),
        "story_media_type": data.get("media_type"),
        "created_at": notif.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    })
```

---

## Frontend Integration

### Mobile App
**File**: `/mobile/src/screens/NotificationsScreen.js`

#### Notification Types Configuration
```javascript
const NOTIFICATION_TYPES = {
  post_like: { icon: 'heart', color: '#e11d48', label: 'liked your post' },
  post_comment: { icon: 'chatbubble', color: '#3b82f6', label: 'commented on your post' },
  story_like: { icon: 'heart', color: '#e11d48', label: 'liked your story' },
  story_comment: { icon: 'chatbubble', color: '#3b82f6', label: 'commented on your story' },
  new_family_story: { icon: 'people', color: '#7c3aed', label: 'shared a family story' },
  follow: { icon: 'person-add', color: '#10b981', label: 'followed you' },
  follow_request: { icon: 'person-add', color: '#f59e0b', label: 'wants to follow you' },
  collab_invite: { icon: 'people', color: '#8b5cf6', label: 'invited you to collaborate' },
  family_invite: { icon: 'home', color: '#7c3aed', label: 'invited you to join family' },
  birthday: { icon: 'gift', color: '#ec4899', label: 'birthday reminder' },
};
```

#### Notification Actions
- **Tap notification**: Navigate to relevant screen (post detail, story detail, profile, etc.)
- **Swipe actions**: Mark as read, delete
- **Pull to refresh**: Fetch latest notifications
- **Badge count**: Shows unread count on tab bar

---

## Best Practices

### When to Send Notifications
✅ **DO send notifications for**:
- Direct interactions (likes, comments, follows)
- Important events (family invites, collab requests)
- Time-sensitive reminders (birthdays, events)
- Content sharing (post to family)

❌ **DON'T send notifications for**:
- User's own actions
- Spam/repetitive actions
- Low-priority updates

### Notification Grouping
- Group similar notifications (e.g., "John and 5 others liked your post")
- Limit notification frequency (e.g., max 1 notification per user per post per hour)
- Batch birthday reminders (daily digest)

### Performance Optimization
- Use database indexes on `user_id`, `type`, `created_at`
- Limit query results (e.g., last 60 notifications)
- Cache unread counts
- Use background jobs for bulk notifications

---

## Testing Checklist

### Post-to-Family Notifications
- [x] Notification sent when post shared to family
- [x] All family members receive notification (except poster)
- [x] Notification includes correct data (story_id, post_id, family_id)
- [x] Notification appears in notifications list
- [x] Tapping notification navigates to story detail
- [x] Unread count updates correctly
- [x] Mark as read works
- [x] No duplicate notifications

### General Notifications
- [x] Post likes generate notifications
- [x] Post comments generate notifications
- [x] Story likes generate notifications
- [x] Story comments generate notifications
- [x] Follow actions generate notifications
- [x] Collab invites generate notifications
- [x] Family invites generate notifications
- [x] Birthday reminders appear
- [x] Unread count accurate
- [x] Mark all as read works
- [x] Navigation from notifications works

---

## Future Enhancements

### Push Notifications
- Integrate Firebase Cloud Messaging (FCM)
- Send push notifications for critical events
- Allow users to customize notification preferences

### Notification Preferences
- Per-type notification settings (enable/disable)
- Quiet hours (mute notifications during specific times)
- Frequency controls (instant, hourly digest, daily digest)

### Rich Notifications
- Inline actions (like, reply without opening app)
- Media previews in notifications
- Grouped notifications with expandable details

### Analytics
- Track notification open rates
- Measure engagement from notifications
- A/B test notification copy

---

## Troubleshooting

### Notifications Not Appearing
1. Check user is authenticated
2. Verify notification was created in database
3. Check notification type is handled in frontend
4. Ensure unread count is updating

### Duplicate Notifications
1. Check for multiple event triggers
2. Verify database constraints
3. Add deduplication logic

### Performance Issues
1. Add database indexes
2. Limit query results
3. Implement pagination
4. Use caching for unread counts

---

**Status**: ✅ Fully Implemented
**Last Updated**: 2024
**Version**: 2.0
