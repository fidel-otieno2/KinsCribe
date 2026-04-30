# Post to Family Story Feature

## Overview
Added a feature that allows users to share their feed posts to family stories with a styled three-dots menu and family selection modal.

## Changes Made

### Frontend (FeedScreen.js)

#### 1. Styled Three-Dots Menu Button
- Replaced plain icon with styled circular button
- Added background color that adapts to theme (dark/light mode)
- Improved visual hierarchy and touch target

#### 2. Post Menu Modal
- **Trigger**: Three-dots button on every post (not just owner's posts)
- **Options**:
  - **Post to Family Story**: Share post to any family the user belongs to
  - **Delete Post**: (Owner only) Remove the post

#### 3. Family Picker Modal
- Shows all families the user is a member of
- Displays family avatar, name, role, and member count
- Visual indicators:
  - Family avatar with gradient fallback
  - Role badges (👑 Owner, ⚙️ Admin, 👤 Member)
  - Member count
- Loading state while posting
- Success/error alerts

#### 4. State Management
- `showMenu`: Controls post menu visibility
- `showFamilyPicker`: Controls family picker visibility
- `families`: Stores user's family list
- `postingToFamily`: Loading state for API call

### Frontend (StoryViewerScreen.js)

#### Music URL Fix
- **Issue**: Deezer music URLs were returning 403 errors on Android
- **Solution**: Applied `toStreamableUri()` utility to music URLs
- **Impact**: Music now plays correctly in family stories shared from posts

### Backend (post_routes.py)

#### New Endpoint: POST `/posts/<post_id>/post-to-family`

**Purpose**: Convert a feed post into a family story

**Request Body**:
```json
{
  "family_id": 123
}
```

**Validation**:
- User must be a member of the target family
- Post must exist

**Process**:
1. Validates family membership
2. Creates new Story record with:
   - Post content as story content
   - Post media (image/video/carousel)
   - Post music metadata (with proper field mapping)
   - Post location
   - Privacy set to "family"
   - User as story author
   - Target family_id
3. Error handling with rollback on failure

**Response**:
```json
{
  "message": "Posted to family",
  "story": { ... }
}
```

**Error Handling**:
- Returns 400 if family_id is missing
- Returns 403 if user is not a member of the family
- Returns 500 with error message if story creation fails
- Database rollback on any error

## Bug Fixes

### 1. Music 403 Errors
- **Problem**: Deezer music URLs in stories were returning HTTP 403 errors
- **Root Cause**: URLs had query parameters and wrong resource type path
- **Fix**: Applied `toStreamableUri()` utility in StoryViewerScreen.js
- **Files Changed**: 
  - `/mobile/src/screens/StoryViewerScreen.js` - Added import and usage of `toStreamableUri()`

### 2. Backend 500 Errors
- **Problem**: Story creation was failing with 500 errors
- **Root Cause**: Missing error handling and improper field mapping
- **Fix**: 
  - Added try-catch with proper error messages
  - Added `hasattr()` checks for optional music fields
  - Combined music_title and music_artist into music_name field
  - Added database rollback on failure
- **Files Changed**:
  - `/backend/routes/post_routes.py` - Enhanced error handling in `post_to_family()` endpoint

## User Flow

1. User taps three-dots menu on any post
2. Menu modal appears with options
3. User taps "Post to Family Story"
4. System fetches user's families via `/family/my-families`
5. Family picker modal appears
6. User selects target family
7. System posts to `/posts/<id>/post-to-family` with family_id
8. Success alert shows "Posted to {Family Name}"
9. Story appears in family feed immediately

## UI/UX Improvements

### Menu Button Styling
- Circular background with theme-aware opacity
- Better touch target (32x32px)
- Smooth press animation (activeOpacity: 0.7)

### Menu Modal Design
- Bottom sheet with rounded corners
- Icon badges with colored backgrounds
- Two-line labels (title + subtitle)
- Chevron indicators for navigation
- Divider between sections
- Destructive styling for delete option (red)

### Family Picker Design
- Bottom sheet with handle
- Title and subtitle for context
- Scrollable list (max 400px height)
- Family avatars with gradient fallbacks
- Role and member count metadata
- Loading spinner during post
- Cancel button at bottom

## Permissions
- **View Menu**: All users can see the menu on any post
- **Post to Family**: Any user who is a member of at least one family
- **Delete Post**: Only post owner

## Technical Details

### API Integration
- Uses existing `/family/my-families` endpoint
- New `/posts/<id>/post-to-family` endpoint
- Proper error handling with user-friendly alerts

### Data Flow
1. Post → Menu → Family List → Selection → Story Creation
2. Optimistic UI with loading states
3. Error rollback with alerts

### Theme Support
- All UI elements adapt to dark/light theme
- Uses theme context for colors
- Consistent with app design system

### Music URL Handling
- Cloudinary URLs are processed through `toStreamableUri()` utility
- Strips query parameters that cause 403 errors
- Fixes resource type path for Android ExoPlayer compatibility

## Future Enhancements
- Add "Share to Multiple Families" option
- Show preview before posting
- Add custom message when sharing
- Track which posts were shared to families
- Prevent duplicate shares to same family
