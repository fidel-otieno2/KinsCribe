# @Mention System Implementation Guide

## Overview
Instagram-style @mention system that works across the entire app. When users type `@`, they get a dropdown with user suggestions they can select to mention/tag someone.

## Components Created

### 1. MentionTextInput (`/mobile/src/components/MentionTextInput.js`)
Reusable text input component with @mention autocomplete.

**Features:**
- Detects `@` symbol and shows user suggestions dropdown
- Real-time user search with 300ms debounce
- Keyboard navigation support
- Auto-focus next character after selection
- Returns array of mentioned users with positions

**Usage:**
```jsx
import MentionTextInput from '../components/MentionTextInput';

<MentionTextInput
  value={text}
  onChangeText={setText}
  onMentionsChange={(mentions) => {
    // mentions = [{id, username, start, end}, ...]
    console.log('Mentioned users:', mentions);
  }}
  placeholder="Write something..."
  multiline
  maxLength={500}
  style={styles.container}
  inputStyle={styles.input}
/>
```

### 2. ParsedText (`/mobile/src/components/ParsedText.js`)
Component to render text with clickable @mentions and #hashtags.

**Features:**
- Parses text and highlights @mentions (purple) and #hashtags (gold)
- Makes mentions clickable - navigates to user profile
- Makes hashtags clickable - can navigate to hashtag feed

**Usage:**
```jsx
import ParsedText from '../components/ParsedText';

<ParsedText style={styles.caption}>
  Hey @john check out #family photos!
</ParsedText>

// Custom handlers
<ParsedText 
  style={styles.text}
  onMentionPress={(username) => console.log('Clicked:', username)}
  onHashtagPress={(tag) => console.log('Hashtag:', tag)}
>
  {post.caption}
</ParsedText>
```

## Backend Endpoint

**GET /users/search**
- Already exists in `/backend/routes/search_routes.py`
- Searches users by name, username, or email
- Returns: `{users: [...], page, has_more}`
- Requires: `q` (query), optional: `page`, `limit`

## Integration Points

### Where to Add @Mentions:

1. **CreateScreen** - Post captions
2. **PostDetailScreen** - Comments
3. **ChatScreen** - Messages
4. **FamilyMomentsScreen** - Family post captions
5. **StoryCameraScreen** - Story captions
6. **Any text input** where users write content

### Where to Add ParsedText:

1. **FeedScreen** - Post captions
2. **PostDetailScreen** - Post captions and comments
3. **ChatScreen** - Message bubbles
4. **ProfileScreen** - Bio text
5. **NotificationsScreen** - Notification text
6. **Any display of user-generated text**

## Implementation Steps

### Step 1: Update CreateScreen (Post Captions)

Replace the caption TextInput with MentionTextInput:

```jsx
import MentionTextInput from '../components/MentionTextInput';

// Add state for mentions
const [mentions, setMentions] = useState([]);

// Replace TextInput with:
<MentionTextInput
  value={caption}
  onChangeText={setCaption}
  onMentionsChange={setMentions}
  placeholder="Write a caption..."
  multiline
  maxLength={2200}
  style={styles.captionContainer}
  inputStyle={styles.captionInput}
/>

// When submitting post, include mentions:
const formData = new FormData();
formData.append('caption', caption);
if (mentions.length > 0) {
  formData.append('mentions', JSON.stringify(mentions.map(m => m.id)));
}
```

### Step 2: Update FeedScreen (Display Mentions)

Replace AppText with ParsedText for captions:

```jsx
import ParsedText from '../components/ParsedText';

// In post rendering:
<ParsedText style={styles.caption}>
  {post.caption}
</ParsedText>
```

### Step 3: Update PostDetailScreen (Comments)

Add MentionTextInput for comment input and ParsedText for displaying comments:

```jsx
// Comment input
<MentionTextInput
  value={commentText}
  onChangeText={setCommentText}
  onMentionsChange={setCommentMentions}
  placeholder="Add a comment..."
  style={styles.commentInput}
/>

// Display comments
{comments.map(comment => (
  <View key={comment.id}>
    <ParsedText style={styles.commentText}>
      {comment.text}
    </ParsedText>
  </View>
))}
```

### Step 4: Update ChatScreen (Messages)

```jsx
// Message input
<MentionTextInput
  value={message}
  onChangeText={setMessage}
  onMentionsChange={setMessageMentions}
  placeholder="Type a message..."
  style={styles.messageInput}
/>

// Display messages
<ParsedText style={styles.messageText}>
  {message.content}
</ParsedText>
```

## Backend Updates Needed

### 1. Add mentions field to Post model
```python
# In models/social.py
class Post(db.Model):
    # ... existing fields
    mentions = db.Column(db.Text)  # JSON array of user IDs
```

### 2. Add mentions field to Comment model
```python
class Comment(db.Model):
    # ... existing fields
    mentions = db.Column(db.Text)  # JSON array of user IDs
```

### 3. Create notifications for mentions
When someone is mentioned, create a notification:
```python
# In post creation/comment creation
if mentions:
    for user_id in mentions:
        notification = Notification(
            user_id=user_id,
            type='mention',
            actor_id=current_user_id,
            post_id=post.id,  # or comment_id
            message=f'{current_user.name} mentioned you'
        )
        db.session.add(notification)
```

## Styling

### Mention Colors
- @mentions: `colors.primary` (#7c3aed - purple)
- #hashtags: `colors.gold` (#c4a35a - gold)

### Suggestion Dropdown
- Background: `colors.bgCard`
- Border: `colors.border2`
- Shadow for elevation
- Max height: 240px
- Appears above input

## Testing Checklist

- [ ] Type @ in post caption - dropdown appears
- [ ] Search shows relevant users
- [ ] Select user - inserts @username
- [ ] Multiple mentions work
- [ ] Mentions are clickable in feed
- [ ] Clicking mention navigates to profile
- [ ] Hashtags are highlighted and clickable
- [ ] Works in comments
- [ ] Works in messages
- [ ] Works in family posts
- [ ] Notifications sent when mentioned
- [ ] Mentions saved to database
- [ ] Mentions load correctly

## Future Enhancements

1. **Mention Suggestions Based on Context**
   - Show family members first in family posts
   - Show recent chat contacts in messages
   - Show followers/following first

2. **Hashtag Autocomplete**
   - Similar dropdown for #hashtags
   - Show trending hashtags
   - Show user's frequently used hashtags

3. **Mention in Photos**
   - Tag people in photos (like Instagram)
   - Show tagged users overlay on image
   - Click tag to see profile

4. **Mention Privacy**
   - Allow users to control who can mention them
   - Approve mentions before showing
   - Hide mentions from blocked users

5. **Rich Notifications**
   - "X mentioned you in a post"
   - Show preview of post/comment
   - Direct link to mentioned content
