# Recipe Share Feature - Complete Implementation

## ✅ Features Implemented

### 1. Share to Direct Message
- Select multiple family members or connections
- Send recipe via DM with optional custom message
- Creates conversation if it doesn't exist
- Sends notification to recipients

### 2. Share to Feed
- Post recipe to your personal feed
- Includes recipe image and title
- Visible to all your connections
- One-tap sharing

### 3. Share UI Components
- **Share Button** in recipe detail reactions bar
- **Share Modal** with two options:
  - "Share to My Feed" button (gradient)
  - User selection list (family + connections)
- **Optional Message Input** for personalization
- **User Selection** with checkboxes
- **Share Counter** showing selected count

## 🔧 Backend Implementation

### API Endpoint
```
POST /api/extras/recipes/{recipe_id}/share
```

### Request Body
```json
{
  "share_type": "user" | "feed",
  "user_ids": [1, 2, 3],  // For user sharing
  "message": "Check out this recipe!",
  "privacy": "public"  // For feed sharing
}
```

### Response
```json
{
  "message": "Recipe shared successfully",
  "shared_with": [
    {"user_id": 1, "name": "John"},
    {"user_id": 2, "name": "Jane"}
  ],
  "share_count": 2
}
```

## 📱 Mobile UI Flow

### 1. User Opens Recipe Detail
- Sees share button in reactions row
- Icon: `share-outline`

### 2. User Taps Share
- Loads family members and connections
- Opens share modal

### 3. Share Modal Options

#### Option A: Share to Feed
- Tap "Share to My Feed" button
- Recipe posted to personal feed
- Success toast shown

#### Option B: Share with People
- Add optional message
- Select users from list (checkboxes)
- Tap "Share with X people" button
- Recipe sent via DM to selected users
- Notifications sent to recipients

## 🔔 Notifications

### When Recipe is Shared via DM
- **Type**: `recipe_share`
- **Title**: "[User Name] shared a recipe"
- **Message**: Recipe title
- **Action**: Opens recipe detail screen

### Message Format
```json
{
  "media_type": "recipe",
  "media_url": "recipe_image_url",
  "metadata": {
    "recipe_id": 123,
    "recipe_title": "Chocolate Cake",
    "recipe_image": "image_url"
  }
}
```

## 💾 Database

### Message with Recipe
- `media_type`: "recipe"
- `metadata`: JSON with recipe info
- Allows rendering recipe card in chat

### Post with Recipe
- `metadata`: JSON with recipe share info
- Type: "recipe_share"
- Links back to original recipe

## 🎨 UI Components

### Share Button
```jsx
<TouchableOpacity style={s.reactionBtn} onPress={() => { 
  loadShareUsers(); 
  setShowShare(true); 
}}>
  <Ionicons name="share-outline" size={20} color={theme.text} />
  <AppText style={s.reactionText}>Share</AppText>
</TouchableOpacity>
```

### Share Modal Structure
1. **Header** - "Share Recipe" title
2. **Share to Feed Button** - Gradient button with globe icon
3. **Divider** - "or share with" text
4. **Message Input** - Optional custom message
5. **User List** - Scrollable list with checkboxes
6. **Share Button** - Shows selected count
7. **Cancel Button**

### User Row
- Avatar (image or initial)
- Name
- Type badge (Family/Connection)
- Checkbox (selected state)

## 🔄 State Management

```javascript
const [showShare, setShowShare] = useState(false);
const [shareUsers, setShareUsers] = useState([]);
const [selectedUsers, setSelectedUsers] = useState([]);
const [shareMessage, setShareMessage] = useState('');
```

## 📊 Functions

### loadShareUsers()
- Fetches family members
- Fetches connections
- Combines and tags with type
- Sets shareUsers state

### handleShare()
- Validates selection
- Calls share API with user IDs
- Shows success/error toast
- Resets modal state

### shareToFeed()
- Calls share API with feed type
- Shows success toast
- Closes modal

## 🎯 User Experience

1. **Quick Share to Feed** - One tap, instant post
2. **Selective Sharing** - Choose specific people
3. **Custom Messages** - Personalize the share
4. **Visual Feedback** - Checkboxes, toasts, counts
5. **Mixed Audience** - Share with family and connections

## 🚀 Usage Example

```javascript
// Share to feed
await api.post(`/extras/recipes/${recipeId}/share`, {
  share_type: 'feed',
  message: 'Try this amazing recipe!',
  privacy: 'public'
});

// Share with users
await api.post(`/extras/recipes/${recipeId}/share`, {
  share_type: 'user',
  user_ids: [1, 2, 3],
  message: 'You should try this!'
});
```

## ✨ Features Summary

✅ Share to personal feed (public post)
✅ Share via direct message (multiple users)
✅ Optional custom message
✅ User selection with checkboxes
✅ Family + connections combined list
✅ Notifications for recipients
✅ Recipe metadata in messages
✅ Success/error feedback
✅ Clean, intuitive UI

## 🔮 Future Enhancements

- [ ] Share to family group chat
- [ ] Share to external apps (WhatsApp, etc.)
- [ ] Share count tracking
- [ ] Most shared recipes analytics
- [ ] Share history
- [ ] Copy recipe link
- [ ] QR code for recipe
