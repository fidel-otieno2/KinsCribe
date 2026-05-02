# Family Budget Notifications & Interactions

## Overview
Complete notification system for family budget entries with reactions and comments functionality, allowing family members to engage with budget entries just like social posts.

## Features Implemented

### 1. **Budget Entry Notifications** ✨ NEW
When an admin or family member adds a budget entry, all other family members receive a notification.

#### Trigger
- **Endpoint**: `POST /extras/budget`
- **When**: Budget entry is created
- **Recipients**: All family members except the creator

#### Notification Details
```json
{
  "type": "budget_entry",
  "title": "{user_name} added a budget entry",
  "message": "{entry_type}: ${amount} - {title}",
  "data": {
    "budget_id": 123,
    "family_id": 456,
    "family_name": "Smith Family",
    "entry_type": "expense",
    "amount": 150.00,
    "category": "food"
  }
}
```

#### Example
- **Title**: "John Doe added a budget entry"
- **Message**: "Expense: $150.00 - Grocery Shopping"
- **Action**: Tap to open Family Budget screen

---

### 2. **Budget Reactions** 👍 NEW
Family members can react to budget entries with emoji reactions.

#### Endpoints

**Get Reactions**
```
GET /extras/budget/{entry_id}/reactions
Authorization: Bearer {token}

Response:
{
  "reactions": [
    {
      "id": 1,
      "budget_id": 123,
      "user_id": 456,
      "user_name": "Jane Doe",
      "user_avatar": "https://...",
      "reaction": "👍",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Add/Update Reaction**
```
POST /extras/budget/{entry_id}/reactions
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "reaction": "👍"  // or "❤️", "😮", "😢", etc.
}

Response:
{
  "reacted": true,
  "reactions": [...]
}
```

**Remove Reaction**
```
DELETE /extras/budget/{entry_id}/reactions/{reaction_id}
Authorization: Bearer {token}

Response:
{
  "message": "Deleted"
}
```

#### Behavior
- **One reaction per user**: User can only have one reaction per budget entry
- **Toggle**: Tapping same reaction removes it
- **Update**: Tapping different reaction updates it
- **Notification**: Entry creator gets notified when someone reacts

#### Reaction Notification
```json
{
  "type": "budget_reaction",
  "title": "{user_name} reacted to your budget entry",
  "message": "{reaction} on {entry_title}",
  "data": {
    "budget_id": 123,
    "reaction": "👍"
  }
}
```

---

### 3. **Budget Comments** 💬 NEW
Family members can comment on budget entries to discuss expenses or income.

#### Endpoints

**Get Comments**
```
GET /extras/budget/{entry_id}/comments
Authorization: Bearer {token}

Response:
{
  "comments": [
    {
      "id": 1,
      "budget_id": 123,
      "user_id": 456,
      "user_name": "Jane Doe",
      "user_avatar": "https://...",
      "text": "Great deal on groceries!",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Add Comment**
```
POST /extras/budget/{entry_id}/comments
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "text": "Great deal on groceries!"
}

Response:
{
  "comment": {
    "id": 1,
    "budget_id": 123,
    "user_id": 456,
    "user_name": "Jane Doe",
    "user_avatar": "https://...",
    "text": "Great deal on groceries!",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Delete Comment**
```
DELETE /extras/budget/{entry_id}/comments/{comment_id}
Authorization: Bearer {token}

Response:
{
  "message": "Deleted"
}
```

#### Comment Notification
```json
{
  "type": "budget_comment",
  "title": "{user_name} commented on your budget entry",
  "message": "{comment_text}",
  "data": {
    "budget_id": 123,
    "comment_id": 456
  }
}
```

---

## Database Models

### BudgetReaction
```python
class BudgetReaction(db.Model):
    __tablename__ = "budget_reactions"
    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey("family_budget.id"))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    reaction = db.Column(db.String(10), default="👍")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("budget_id", "user_id"),)
```

### BudgetComment
```python
class BudgetComment(db.Model):
    __tablename__ = "budget_comments"
    id = db.Column(db.Integer, primary_key=True)
    budget_id = db.Column(db.Integer, db.ForeignKey("family_budget.id"))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

---

## Mobile App Integration

### Notification Handling

**Add to NotificationsScreen.js**:
```javascript
const NOTIFICATION_TYPES = {
  // ... existing types
  budget_entry: { 
    icon: 'wallet', 
    color: '#f59e0b', 
    label: 'added a budget entry' 
  },
  budget_reaction: { 
    icon: 'heart', 
    color: '#e11d48', 
    label: 'reacted to your budget entry' 
  },
  budget_comment: { 
    icon: 'chatbubble', 
    color: '#3b82f6', 
    label: 'commented on your budget entry' 
  },
};
```

**Navigation**:
```javascript
const handleNotificationPress = (notif) => {
  if (notif.type === 'budget_entry' || 
      notif.type === 'budget_reaction' || 
      notif.type === 'budget_comment') {
    navigation.navigate('FamilyBudget', {
      highlightEntryId: notif.budget_id
    });
  }
};
```

### Budget Entry Detail Modal

**Add to FamilyBudgetScreen.js**:
```javascript
const [showDetail, setShowDetail] = useState(false);
const [selectedEntry, setSelectedEntry] = useState(null);
const [reactions, setReactions] = useState([]);
const [comments, setComments] = useState([]);

// Fetch reactions and comments
const fetchInteractions = async (entryId) => {
  const [reactionsRes, commentsRes] = await Promise.all([
    api.get(`/extras/budget/${entryId}/reactions`),
    api.get(`/extras/budget/${entryId}/comments`)
  ]);
  setReactions(reactionsRes.data.reactions);
  setComments(commentsRes.data.comments);
};

// Add reaction
const addReaction = async (entryId, emoji) => {
  const { data } = await api.post(`/extras/budget/${entryId}/reactions`, {
    reaction: emoji
  });
  setReactions(data.reactions);
};

// Add comment
const addComment = async (entryId, text) => {
  const { data } = await api.post(`/extras/budget/${entryId}/comments`, {
    text
  });
  setComments(prev => [data.comment, ...prev]);
};
```

---

## User Flows

### Flow 1: Admin Adds Budget Entry
1. **Admin opens Family Budget screen**
2. **Admin taps + button**
3. **Admin fills form**: Title, Amount, Category, Type (Income/Expense)
4. **Admin taps "Add Expense" or "Add Income"**
5. **System creates budget entry**
6. **System sends notifications to all family members**
7. **Family members see notification**: "John added a budget entry"
8. **Family members tap notification**
9. **Opens Family Budget screen with entry highlighted**

### Flow 2: Family Member Reacts to Entry
1. **User opens Family Budget screen**
2. **User taps on budget entry**
3. **Detail modal opens showing entry details**
4. **User sees reaction bar**: 👍 ❤️ 😮 😢 🎉
5. **User taps reaction emoji**
6. **Reaction is added/updated**
7. **Entry creator receives notification**: "Jane reacted to your budget entry"
8. **Reaction count updates in real-time**

### Flow 3: Family Member Comments on Entry
1. **User opens budget entry detail**
2. **User scrolls to comments section**
3. **User types comment**: "Great deal on groceries!"
4. **User taps Send**
5. **Comment appears immediately**
6. **Entry creator receives notification**: "Jane commented on your budget entry"
7. **Other family members can see and reply to comments**

---

## UI Components

### Budget Entry Card (Enhanced)
```
┌─────────────────────────────────────┐
│ 🍔 Grocery Shopping                 │
│ John Doe · Food                     │
│ Bought weekly groceries             │
│                                     │
│ -$150.00                  Jan 15    │
│                                     │
│ 👍 3  💬 2                          │
└─────────────────────────────────────┘
```

### Budget Entry Detail Modal
```
┌─────────────────────────────────────┐
│              Grocery Shopping        │
│                                     │
│ 🍔 Food · Expense                   │
│ $150.00                             │
│                                     │
│ Added by John Doe                   │
│ January 15, 2024                    │
│                                     │
│ Notes:                              │
│ Bought weekly groceries at Walmart  │
│                                     │
│ ─────────────────────────────────   │
│                                     │
│ Reactions                           │
│ 👍 ❤️ 😮 😢 🎉                      │
│                                     │
│ Jane, Mike, Sarah reacted 👍        │
│                                     │
│ ─────────────────────────────────   │
│                                     │
│ Comments (2)                        │
│                                     │
│ 👤 Jane Doe                         │
│    Great deal on groceries!         │
│    2 hours ago                      │
│                                     │
│ 👤 Mike Smith                       │
│    Thanks for shopping!             │
│    1 hour ago                       │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ Add a comment...            │    │
│ └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## Notification Examples

### Budget Entry Added
```
┌─────────────────────────────────────┐
│ 💰 John Doe added a budget entry    │
│ Expense: $150.00 - Grocery Shopping │
│ 2 minutes ago                       │
└─────────────────────────────────────┘
```

### Budget Reaction
```
┌─────────────────────────────────────┐
│ ❤️ Jane Doe reacted to your budget  │
│ ❤️ on Grocery Shopping              │
│ 5 minutes ago                       │
└─────────────────────────────────────┘
```

### Budget Comment
```
┌─────────────────────────────────────┐
│ 💬 Mike Smith commented on your     │
│ Great deal on groceries!            │
│ 10 minutes ago                      │
└─────────────────────────────────────┘
```

---

## Benefits

### For Families
✅ **Transparency**: Everyone knows about family expenses
✅ **Accountability**: Members can discuss spending decisions
✅ **Engagement**: Makes budgeting a collaborative activity
✅ **Awareness**: Real-time updates on family finances

### For Admins
✅ **Feedback**: Get reactions and comments on entries
✅ **Communication**: Discuss expenses with family
✅ **Tracking**: See who's engaged with budget

### For Members
✅ **Visibility**: Stay informed about family finances
✅ **Input**: Share opinions on expenses
✅ **Questions**: Ask about specific entries
✅ **Appreciation**: React positively to good deals

---

## Best Practices

### When to Send Notifications
✅ **DO notify for**:
- New budget entries (income or expense)
- Reactions on your entries
- Comments on your entries

❌ **DON'T notify for**:
- Your own actions
- Budget entry edits (optional)
- Deleted entries

### Reaction Guidelines
- Use 👍 for approval
- Use ❤️ for appreciation
- Use 😮 for surprise at amount
- Use 😢 for concern about expense
- Use 🎉 for celebrating income

### Comment Etiquette
- Be constructive
- Ask questions politely
- Suggest alternatives
- Appreciate good deals
- Discuss major expenses

---

## Testing Checklist

### Backend
- [x] Budget entry creates notification
- [x] All family members receive notification (except creator)
- [x] Notification includes correct data
- [x] Reactions can be added/updated/removed
- [x] Comments can be added/deleted
- [x] Reaction notifications sent to entry creator
- [x] Comment notifications sent to entry creator
- [x] No self-notifications

### Frontend (To Implement)
- [ ] Notification appears in notifications list
- [ ] Tapping notification opens Family Budget screen
- [ ] Budget entry shows reaction count
- [ ] Budget entry shows comment count
- [ ] Detail modal shows reactions
- [ ] Detail modal shows comments
- [ ] Can add reactions
- [ ] Can add comments
- [ ] Real-time updates

---

## Future Enhancements

### Advanced Features
1. **Budget Alerts**: Notify when spending exceeds category limits
2. **Monthly Summary**: Digest notification at month end
3. **Recurring Entry Reminders**: Notify before recurring expenses
4. **Budget Goals**: Celebrate when savings goals are met
5. **Expense Approval**: Require approval for large expenses
6. **Receipt Attachments**: Comment with receipt photos
7. **Split Expenses**: Tag who owes what
8. **Budget Insights**: AI-powered spending analysis

### Social Features
1. **Reaction Leaderboard**: Most engaged family member
2. **Comment Threads**: Reply to specific comments
3. **Mention Members**: @mention in comments
4. **Budget Challenges**: Gamify saving money
5. **Expense Polls**: Vote on major purchases

---

## Files Modified

### Backend
1. `/backend/routes/extras_routes.py`
   - Added notification logic to `add_budget_entry()`
   - Added `/budget/{entry_id}/reactions` endpoints
   - Added `/budget/{entry_id}/comments` endpoints

2. `/backend/models/extras.py`
   - Added `BudgetReaction` model
   - Added `BudgetComment` model

3. `/backend/routes/notification_routes.py`
   - Added budget notification retrieval logic

### Frontend (To Implement)
1. `/mobile/src/screens/FamilyBudgetScreen.js`
   - Add budget entry detail modal
   - Add reactions UI
   - Add comments UI
   - Handle notification navigation

2. `/mobile/src/screens/NotificationsScreen.js`
   - Add budget notification types
   - Add navigation handling

---

## Database Migration

Run these SQL commands to create the new tables:

```sql
CREATE TABLE budget_reactions (
    id SERIAL PRIMARY KEY,
    budget_id INTEGER NOT NULL REFERENCES family_budget(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction VARCHAR(10) DEFAULT '👍',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(budget_id, user_id)
);

CREATE TABLE budget_comments (
    id SERIAL PRIMARY KEY,
    budget_id INTEGER NOT NULL REFERENCES family_budget(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budget_reactions_budget ON budget_reactions(budget_id);
CREATE INDEX idx_budget_reactions_user ON budget_reactions(user_id);
CREATE INDEX idx_budget_comments_budget ON budget_comments(budget_id);
CREATE INDEX idx_budget_comments_user ON budget_comments(user_id);
```

---

**Status**: ✅ Backend Fully Implemented | ⏳ Frontend Pending
**Version**: 1.0
**Last Updated**: 2024
