# Complete @Mention System - Implementation Guide

## System Architecture

```
User types @ anywhere
    ↓
useMention hook detects @
    ↓
Watches cursor position + text
    ↓
MentionDropdown appears
    ↓
Floating above keyboard
    ↓
Search /users?q=query
    ↓
Debounced 300ms, min 1 char
    ↓
User taps a result
    ↓
@username injected, styled purple
    ↓
On post/comment submit
    ↓
Parse @tags, send push + in-app notification
    ↓
Notification: Push alert, In-app bell, Mention badge
```

## Components Created

### 1. `useMention` Hook (`/mobile/src/hooks/useMention.js`)
- Detects @ symbol in text
- Watches cursor position
- Searches users with 300ms debounce
- Manages mention state
- Tracks all mentions

### 2. `MentionDropdown` Component (`/mobile/src/components/MentionDropdown.js`)
- Floats above keyboard
- Shows user search results
- Displays avatars and usernames
- Handles selection

### 3. `MentionInput` Component (`/mobile/src/components/MentionInput.js`)
- TextInput with built-in mention support
- Combines useMention + MentionDropdown
- Easy drop-in replacement for TextInput

### 4. `ParsedText` Component (`/mobile/src/components/ParsedText.js`)
- Renders text with styled @mentions
- Purple background + bold text
- Tappable → navigates to profile
- Also handles #hashtags

## Usage Examples

### Example 1: Post Caption (CreateScreen)

```jsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MentionInput from '../components/MentionInput';
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
      
      // Send mentioned user IDs
      if (mentions.length > 0) {
        const mentionIds = mentions.map(m => m.id);
        formData.append('mentions', JSON.stringify(mentionIds));
      }
      
      await api.post('/posts', formData);
      
      // Success - reset form
      setCaption('');
      setMentions([]);
    } catch (error) {
      console.error('Post failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MentionInput
        value={caption}
        onChangeText={setCaption}
        onMentionsChange={setMentions}
        placeholder="What's on your mind? Type @ to mention..."
        multiline
        maxLength={2200}
        style={styles.inputContainer}
        inputStyle={styles.input}
      />
      
      <GradientButton
        label="Post"
        onPress={handlePost}
        loading={loading}
        disabled={!caption.trim()}
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

### Example 2: Display Post with Mentions (FeedScreen)

```jsx
import { View, StyleSheet } from 'react-native';
import ParsedText from '../components/ParsedText';
import AppText from '../components/AppText';

function PostCard({ post }) {
  return (
    <View style={styles.card}>
      <AppText style={styles.author}>{post.user.name}</AppText>
      
      {/* Caption with tappable @mentions */}
      <ParsedText 
        style={styles.caption}
        mentions={post.mentions || []}
      >
        {post.caption}
      </ParsedText>
      
      {/* Show mention count */}
      {post.mentions && post.mentions.length > 0 && (
        <AppText style={styles.mentionCount}>
          {post.mentions.length} {post.mentions.length === 1 ? 'person' : 'people'} mentioned
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, backgroundColor: '#fff' },
  author: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  caption: { fontSize: 15, lineHeight: 22 },
  mentionCount: { fontSize: 12, color: '#888', marginTop: 8 },
});
```

### Example 3: Comments with Mentions (PostDetailScreen)

```jsx
import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import MentionInput from '../components/MentionInput';
import ParsedText from '../components/ParsedText';
import GradientButton from '../components/GradientButton';
import api from '../api/axios';

export default function CommentsSection({ postId, comments, onCommentAdded }) {
  const [commentText, setCommentText] = useState('');
  const [commentMentions, setCommentMentions] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleComment = async () => {
    if (!commentText.trim()) return;
    
    setLoading(true);
    try {
      const mentionIds = commentMentions.map(m => m.id);
      
      await api.post(`/posts/${postId}/comments`, {
        text: commentText,
        mentions: mentionIds,
      });
      
      setCommentText('');
      setCommentMentions([]);
      
      if (onCommentAdded) onCommentAdded();
    } catch (error) {
      console.error('Comment failed:', error);
    } finally {
      setLoading(false);
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
        <MentionInput
          value={commentText}
          onChangeText={setCommentText}
          onMentionsChange={setCommentMentions}
          placeholder="Add a comment... Type @ to mention"
          style={styles.commentInput}
          inputStyle={styles.commentInputText}
        />
        <GradientButton
          label="Post"
          onPress={handleComment}
          loading={loading}
          disabled={!commentText.trim()}
          style={styles.postBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  comment: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  commentAuthor: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  commentText: { fontSize: 14, lineHeight: 20 },
  inputRow: { 
    flexDirection: 'row', 
    padding: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#eee',
    gap: 8,
  },
  commentInput: { flex: 1 },
  commentInputText: { fontSize: 14 },
  postBtn: { alignSelf: 'flex-end' },
});
```

### Example 4: Chat/DM with Mentions (ChatScreen)

```jsx
import { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import MentionInput from '../components/MentionInput';
import ParsedText from '../components/ParsedText';
import { Ionicons } from '@expo/vector-icons';
import api from '../api/axios';

export default function ChatScreen({ conversationId, messages }) {
  const [message, setMessage] = useState('');
  const [messageMentions, setMessageMentions] = useState([]);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    setSending(true);
    try {
      const mentionIds = messageMentions.map(m => m.id);
      
      await api.post(`/messages/${conversationId}`, {
        content: message,
        mentions: mentionIds,
      });
      
      setMessage('');
      setMessageMentions([]);
    } catch (error) {
      console.error('Send failed:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble,
            item.isMe && styles.myMessage
          ]}>
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
        <MentionInput
          value={message}
          onChangeText={setMessage}
          onMentionsChange={setMessageMentions}
          placeholder="Type @ to mention..."
          style={styles.messageInput}
          inputStyle={styles.messageInputText}
        />
        <TouchableOpacity 
          onPress={handleSend} 
          disabled={!message.trim() || sending}
          style={styles.sendBtn}
        >
          <Ionicons 
            name="send" 
            size={24} 
            color={message.trim() ? '#7c3aed' : '#ccc'} 
          />
        </TouchableOpacity>
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
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#7c3aed',
    alignSelf: 'flex-end',
  },
  messageText: { fontSize: 15 },
  inputRow: { 
    flexDirection: 'row', 
    padding: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#eee',
    alignItems: 'center',
    gap: 8,
  },
  messageInput: { flex: 1 },
  messageInputText: { fontSize: 15 },
  sendBtn: { padding: 8 },
});
```

### Example 5: Story Caption with Mentions

```jsx
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MentionInput from '../components/MentionInput';
import api from '../api/axios';

export default function StoryCaptionScreen({ storyMedia }) {
  const [caption, setCaption] = useState('');
  const [mentions, setMentions] = useState([]);

  const handlePost = async () => {
    const formData = new FormData();
    formData.append('media', storyMedia);
    formData.append('caption', caption);
    
    if (mentions.length > 0) {
      formData.append('mentions', JSON.stringify(mentions.map(m => m.id)));
    }
    
    await api.post('/stories', formData);
  };

  return (
    <View style={styles.container}>
      <MentionInput
        value={caption}
        onChangeText={setCaption}
        onMentionsChange={setMentions}
        placeholder="Add caption... Type @ to mention"
        multiline
        maxLength={500}
        style={styles.input}
      />
    </View>
  );
}
```

## Backend Integration

### 1. Update Models

```python
# In models/social.py
class Post(db.Model):
    # ... existing fields
    mentions = db.Column(db.Text)  # JSON: "[1, 5, 12]"
    
    def to_dict(self, current_user_id=None):
        data = {
            # ... existing fields
            'mentions': self.get_mentions()
        }
        return data
    
    def get_mentions(self):
        """Get mentioned users"""
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

# Same for Comment and Message models
```

### 2. Create Post with Mentions

```python
# In routes/post_routes.py
@post_bp.route('', methods=['POST'])
@jwt_required()
def create_post():
    current_user_id = int(get_jwt_identity())
    
    caption = request.form.get('caption', '')
    mentions = request.form.get('mentions')  # JSON: "[1, 5, 12]"
    
    post = Post(
        user_id=current_user_id,
        caption=caption,
        mentions=mentions,
        # ... other fields
    )
    
    db.session.add(post)
    db.session.commit()
    
    # Send notifications to mentioned users
    if mentions:
        send_mention_notifications(post, mentions, current_user_id)
    
    return jsonify(post.to_dict(current_user_id)), 201
```

### 3. Send Mention Notifications

```python
def send_mention_notifications(post, mentions_json, actor_id):
    """Send notifications to mentioned users"""
    import json
    
    try:
        mentioned_ids = json.loads(mentions_json)
        actor = User.query.get(actor_id)
        
        for user_id in mentioned_ids:
            if user_id == actor_id:
                continue  # Don't notify yourself
            
            # Create in-app notification
            notification = Notification(
                user_id=user_id,
                type='mention',
                actor_id=actor_id,
                post_id=post.id,
                message=f'{actor.name} mentioned you in a post',
                created_at=datetime.utcnow()
            )
            db.session.add(notification)
            
            # Send push notification
            user = User.query.get(user_id)
            if user and user.push_token:
                send_push_notification(
                    token=user.push_token,
                    title=f'{actor.name} mentioned you',
                    body=post.caption[:100],
                    data={
                        'type': 'mention',
                        'post_id': post.id,
                        'actor_id': actor_id
                    }
                )
        
        db.session.commit()
    except Exception as e:
        print(f'Error sending mention notifications: {e}')
```

## Visual Design

### Mention Styling
- **Color**: `#8b5cf6` (Purple)
- **Background**: `rgba(139, 92, 246, 0.15)` (Light purple)
- **Font Weight**: 700 (Bold)
- **Padding**: 6px horizontal, 2px vertical
- **Border Radius**: 6px

### Hashtag Styling
- **Color**: `#c4a35a` (Gold)
- **Background**: `rgba(196, 163, 90, 0.1)` (Light gold)
- **Font Weight**: 600 (Semi-bold)
- **Padding**: 6px horizontal, 2px vertical
- **Border Radius**: 6px

## Summary

✅ **useMention hook** - Detects @ and manages state
✅ **MentionDropdown** - Floats above keyboard
✅ **MentionInput** - Easy drop-in replacement
✅ **ParsedText** - Styled, tappable mentions
✅ **Works everywhere** - Posts, comments, chat, stories
✅ **Backend ready** - Notifications + push alerts
✅ **Fully styled** - Purple badges, distinct from text
