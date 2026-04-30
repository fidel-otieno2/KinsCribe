# Family Story Controls Implementation

## Overview
Implemented comprehensive archive and highlight system for family stories with controls accessible to story owners and family admins.

## Features Implemented

### 1. Archive System
**Backend** (`/backend/routes/story_routes.py`):
- ✅ `POST /stories/<id>/archive` - Toggle archive status (owner only)
- ✅ `GET /stories/archived` - Get user's archived stories
- ✅ Stories excluded from family feed by default when archived
- ✅ Archive timestamp tracking (`archived_at`)

**Mobile** (`/mobile/src/screens/FamilyScreen.js`):
- ✅ Archive button on story cards (owner only)
- ✅ Visual "Archived" badge on archived stories
- ✅ Archive icon in action row (archive/unarchive toggle)
- ✅ Optimistic UI updates

**Mobile** (`/mobile/src/screens/ProfileScreen.js`):
- ✅ New "Archived" tab in profile
- ✅ Grid view of archived stories
- ✅ Archive badge overlay on thumbnails
- ✅ Empty state with explanation

### 2. Highlight System
**Backend** (`/backend/routes/story_routes.py`):
- ✅ `POST /stories/<id>/highlight` - Toggle highlight (owner or family admin)
- ✅ `GET /stories/family/<id>/highlights` - Get family highlights
- ✅ Highlight timestamp tracking (`highlighted_at`)
- ✅ Permission check: owner OR family admin can highlight

**Mobile** (`/mobile/src/screens/FamilyScreen.js`):
- ✅ "Family Highlights" section at top of feed
- ✅ Horizontal scrollable highlight cards
- ✅ Highlight button on story cards (owner or admin)
- ✅ Visual "Highlighted" badge on highlighted stories
- ✅ Star icon in action row (highlight/unhighlight toggle)
- ✅ Thumbnail preview with play icon for videos
- ✅ Author avatar and name on highlight cards

### 3. Story Controls UI
**Action Buttons** (FamilyScreen story cards):
```
❤️ Like | 💬 Comment | 📦 Archive (owner) | ⭐ Highlight (owner/admin)
```

**Visual Indicators**:
- 📦 Orange "Archived" badge
- ⭐ Purple "Highlighted" badge
- Badges appear at top of story card when applicable

### 4. Auto-Save Locations
Stories are automatically accessible from:
- ✅ **Personal Profile** - Archived tab shows user's archived stories
- ✅ **Family Archive** - Archived stories excluded from main feed but retrievable via API
- ✅ **Family Highlights** - Highlighted stories featured prominently in family feed

## Database Schema
Already existed in `models/story.py`:
```python
is_archived = db.Column(db.Boolean, default=False)
is_highlighted = db.Column(db.Boolean, default=False)
archived_at = db.Column(db.DateTime, nullable=True)
highlighted_at = db.Column(db.DateTime, nullable=True)
```

## API Endpoints

### Archive
- `POST /stories/<id>/archive` - Toggle archive (owner only)
- `GET /stories/archived` - Get user's archived stories

### Highlight
- `POST /stories/<id>/highlight` - Toggle highlight (owner or admin)
- `GET /stories/family/<id>/highlights` - Get family highlights

## Permissions

### Archive
- ✅ Only story owner can archive/unarchive their own stories
- ✅ Archived stories hidden from family feed
- ✅ Archived stories visible in user's profile "Archived" tab

### Highlight
- ✅ Story owner can highlight their own stories
- ✅ Family admins can highlight any story in their family
- ✅ Highlighted stories featured in "Family Highlights" section
- ✅ Highlighted stories remain in main feed with badge

## UI/UX Flow

### Archiving a Story
1. User taps archive icon on their story
2. Story immediately shows "Archived" badge
3. Story removed from family feed on next refresh
4. Story appears in user's profile → Archived tab
5. Tap archive icon again to unarchive

### Highlighting a Story
1. Owner or admin taps star icon on story
2. Story immediately shows "Highlighted" badge
3. Story appears in "Family Highlights" section at top of feed
4. Story remains in main feed with highlight badge
5. Tap star icon again to remove highlight

### Viewing Highlights
1. Scroll "Family Highlights" horizontal section
2. Tap highlight card to view full story
3. Highlights show thumbnail, title, and author
4. Video highlights show play icon overlay

## Files Modified

### Backend
- `/backend/models/story.py` - Already had archive/highlight fields
- `/backend/routes/story_routes.py` - Added toggle endpoints

### Mobile
- `/mobile/src/screens/FamilyScreen.js` - Archive/highlight controls + highlights section
- `/mobile/src/screens/ProfileScreen.js` - Archived tab
- `/mobile/src/utils/cloudinary.js` - Created (for video 403 fix)
- `/mobile/src/components/VideoPlayer.js` - Updated to use cloudinary util

## Additional Fixes
While implementing, also fixed:
- ✅ Android ExoPlayer 403 errors for Cloudinary videos
- ✅ Android ExoPlayer 403 errors for Cloudinary music/audio
- ✅ Created shared `toStreamableUri` utility for Cloudinary URL fixes

## Testing Checklist
- [ ] Archive story as owner
- [ ] Verify archived story hidden from family feed
- [ ] View archived stories in profile Archived tab
- [ ] Unarchive story and verify it reappears in feed
- [ ] Highlight story as owner
- [ ] Highlight story as family admin
- [ ] Verify highlighted story appears in Family Highlights section
- [ ] Verify highlighted story has badge in main feed
- [ ] Remove highlight and verify it disappears from highlights section
- [ ] Test permissions: non-admin cannot highlight others' stories
- [ ] Test permissions: non-owner cannot archive others' stories

## Future Enhancements
- [ ] Bulk archive/unarchive
- [ ] Archive expiration (auto-delete after X days)
- [ ] Highlight collections/categories
- [ ] Highlight reordering
- [ ] Export archived stories
- [ ] Restore deleted stories from archive
