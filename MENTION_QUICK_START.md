# @Mention System - Quick Start Guide

## How It Works

### 1. When User Types @ Symbol
- Dropdown appears immediately with user suggestions
- As user types letters after @, list auto-filters
- Example: `@j` shows John, Jane, Jack
- Example: `@jo` shows only John

### 2. When User Selects Username
- Username is inserted WITHOUT @ symbol
- Example: User selects "john" → text becomes "Hey john how are you?"
- Mention is tracked internally with user ID

### 3. When Text is Displayed
- Username appears in purple and is tappable
- Tapping navigates to that user's profile
- Works everywhere: posts, comments, messages, bio, etc.

## Implementation Examples

### Example 1: Create Post with Mentions

```jsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MentionTextInput from '../components/MentionTextInput';
import GradientButton from '../components/GradientButton';
import api from '../api/axios';

export default function CreatePostScreen() {
  const [caption, setCaption] = useState('');
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handlePost = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      
      // Send mentioned user IDs to backend
      if (mentions.length > 0) {
        formData.append('mentions', JSON.stringify(mentions.map(m => m.id)));
      }
      
      await api.post('/posts', formData);
      // Success!
    } catch (error) {
      console.error('Post failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MentionTextInput
        value={caption}
        onChangeText={setCaption}
        onMentionsChange={setMentions}
        placeholder="What's on your mind? Type @ to mention someone..."
        multiline
        maxLength={2200}
        style={styles.inputContainer}
        inputStyle={styles.input}
      />
      
      <GradientButton
        label="Post"
        onPress={handlePost}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  inputContainer: { marginBottom: 16 },
  input: { 
    minHeight: 120, 
    fontSize: 16,
    padding: 12,
  },
});
```

### Example 2: Display Post with Tappable Mentions

```jsx
import { View, StyleSheet } from 'react-native';
import ParsedText from '../components/ParsedText';
import AppText from '../components/AppText';

export default function PostCard({ post }) {
  return (
    <View style={styles.card}>
      <AppText style={styles.author}>{post.user.name}</AppText>
      
      {/* Caption with tappable mentions */}
      <ParsedText 
        style={styles.caption}
        mentions={post.mentions || []}
      >
        {post.caption}
      </ParsedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, backgroundColor: '#fff' },
  author: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  caption: { fontSize: 15, lineHeight: 22 },
});
```

### Example 3: Comments with Mentions

```jsx
import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import MentionTextInput from '../components/MentionTextInput';
import ParsedText from '../components/ParsedText';
import api from '../api/axios';

export default function CommentsSection({ postId, comments }) {
  const [commentText, setCommentText] = useState('');
  const [commentMentions, setCommentMentions] = useState([]);

  const handleComment = async () => {
    try {
      await api.post(`/posts/${postId}/comments`, {
        text: commentText,
        mentions: commentMentions.map(m => m.id),
      });
      setCommentText('');
      setCommentMentions([]);
    } catch (error) {
      console.error('Comment failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Display comments */}
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <AppText style={styles.commentAuthor}>{item.user.name}</AppText>
            <ParsedText 
              style={styles.commentText}
              mentions={item.mentions || []}
            >
              {item.text}
            </ParsedText>
          </View>
        )}
      />
      
      {/* Comment input */}
      <View style={styles.inputRow}>
        <MentionTextInput
          value={commentText}
          onChangeText={setCommentText}
          onMentionsChange={setCommentMentions}
          placeholder="Add a comment..."
          style={styles.commentInput}
          inputStyle={styles.commentInputText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  comment: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  commentAuthor: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  commentText: { fontSize: 14 },
  inputRow: { padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  commentInput: { flex: 1 },
  commentInputText: { fontSize: 14 },
});
```

### Example 4: Messages with Mentions

```jsx
import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import MentionTextInput from '../components/MentionTextInput';
import ParsedText from '../components/ParsedText';
import api from '../api/axios';

export default function ChatScreen({ conversationId, messages }) {
  const [message, setMessage] = useState('');
  const [messageMentions, setMessageMentions] = useState([]);

  const handleSend = async () => {
    try {
      await api.post(`/messages/${conversationId}`, {
        content: message,
        mentions: messageMentions.map(m => m.id),
      });
      setMessage('');
      setMessageMentions([]);
    } catch (error) {
      console.error('Send failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.messageBubble}>
            <ParsedText 
              style={styles.messageText}
              mentions={item.mentions || []}
            >
              {item.content}
            </ParsedText>
          </View>
        )}
      />
      
      {/* Input */}
      <View style={styles.inputRow}>
        <MentionTextInput
          value={message}
          onChangeText={setMessage}
          onMentionsChange={setMessageMentions}
          placeholder="Type @ to mention..."
          style={styles.messageInput}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageBubble: { 
    padding: 12, 
    margin: 8, 
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  messageText: { fontSize: 15 },
  inputRow: { padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  messageInput: { flex: 1 },
});
```

## Backend Updates Needed

### 1. Update Post Model (add mentions field)

```python
# In backend/models/social.py
class Post(db.Model):
    # ... existing fields
    mentions = db.Column(db.Text)  # Store as JSON: "[1, 5, 12]"
    
    def to_dict(self, current_user_id=None):
        data = {
            # ... existing fields
            'mentions': self.parse_mentions() if self.mentions else []
        }
        return data
    
    def parse_mentions(self):
        """Parse mentions JSON to list of user objects"""
        if not self.mentions:
            return []
        try:
            import json
            user_ids = json.loads(self.mentions)
            users = User.query.filter(User.id.in_(user_ids)).all()
            return [{
                'id': u.id,
                'username': u.username,
                'name': u.name,
                'avatar_url': u.avatar_url
            } for u in users]
        except:
            return []
```

### 2. Update Post Creation Endpoint

```python
# In backend/routes/post_routes.py
@post_bp.route('', methods=['POST'])
@jwt_required()
def create_post():
    current_user_id = int(get_jwt_identity())
    
    caption = request.form.get('caption', '')
    mentions = request.form.get('mentions')  # JSON string: "[1, 5, 12]"
    
    post = Post(
        user_id=current_user_id,
        caption=caption,
        mentions=mentions,  # Store as-is
        # ... other fields
    )
    
    db.session.add(post)
    db.session.commit()
    
    # Send notifications to mentioned users
    if mentions:
        import json
        mentioned_ids = json.loads(mentions)
        for user_id in mentioned_ids:
            if user_id != current_user_id:
                notification = Notification(
                    user_id=user_id,
                    type='mention',
                    actor_id=current_user_id,
                    post_id=post.id,
                    message=f'mentioned you in a post'
                )
                db.session.add(notification)
        db.session.commit()
    
    return jsonify(post.to_dict(current_user_id)), 201
```

### 3. Same for Comments and Messages

Apply the same pattern to Comment and Message models.

## Testing Steps

1. **Type @ in any text input**
   - ✅ Dropdown appears with users
   
2. **Type letters after @**
   - ✅ List filters automatically
   - Example: `@j` → shows John, Jane
   - Example: `@jo` → shows only John
   
3. **Select a user**
   - ✅ Username inserted without @
   - ✅ Text: "Hey john" (not "Hey @john")
   
4. **Post/Send the content**
   - ✅ Mention IDs saved to backend
   
5. **View the content**
   - ✅ Username appears in purple
   - ✅ Username is tappable
   
6. **Tap the username**
   - ✅ Navigates to user profile
   
7. **Test everywhere**
   - ✅ Posts
   - ✅ Comments
   - ✅ Messages
   - ✅ Bio
   - ✅ Family posts

## Summary

- **Type @** → Dropdown with users appears
- **Type letters** → Auto-filters (e.g., @j shows John, Jane)
- **Select user** → Inserts "john" (no @ symbol)
- **Display** → "john" appears purple and tappable
- **Tap** → Goes to john's profile
- **Works everywhere** → Posts, comments, messages, bio, etc.
