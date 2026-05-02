# @Mention System - Visual Flow

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User Types @                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Text Input: "Hey @"                                        │
│              ↓                                               │
│  ┌──────────────────────────────────────┐                  │
│  │  🔍 Search Users                      │                  │
│  ├──────────────────────────────────────┤                  │
│  │  👤 john_smith                        │                  │
│  │  👤 jane_doe                          │                  │
│  │  👤 jack_wilson                       │                  │
│  │  👤 jennifer_lee                      │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 2: User Types Letters (Auto-Filter)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Text Input: "Hey @jo"                                      │
│              ↓                                               │
│  ┌──────────────────────────────────────┐                  │
│  │  🔍 Filtering...                      │                  │
│  ├──────────────────────────────────────┤                  │
│  │  👤 john_smith          ✓ Match       │                  │
│  │  👤 jordan_brown        ✓ Match       │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
│  (jane_doe, jack_wilson filtered out)                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 3: User Selects Username                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User taps: john_smith                                      │
│              ↓                                               │
│  Text Input: "Hey john_smith how are you?"                  │
│                   ^^^^^^^^^^                                 │
│                   (NO @ symbol!)                             │
│                                                              │
│  Internally stored:                                          │
│  mentions = [{                                               │
│    id: 123,                                                  │
│    username: "john_smith",                                   │
│    start: 4,                                                 │
│    end: 14                                                   │
│  }]                                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 4: User Posts/Sends                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /posts                                                 │
│  {                                                           │
│    caption: "Hey john_smith how are you?",                  │
│    mentions: [123]  ← User IDs                              │
│  }                                                           │
│              ↓                                               │
│  Backend saves post + mentions                               │
│  Backend sends notification to user 123                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Display Post (Tappable Username)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────┐                    │
│  │  📱 Post Card                       │                    │
│  ├────────────────────────────────────┤                    │
│  │  Sarah Johnson                      │                    │
│  │  @sarah_j · 2h ago                  │                    │
│  │                                     │                    │
│  │  Hey john_smith how are you?       │                    │
│  │      ^^^^^^^^^^                     │                    │
│  │      (Purple, Bold, Tappable)       │                    │
│  │                                     │                    │
│  │  [❤️ 24]  [💬 5]  [🔄 2]           │                    │
│  └────────────────────────────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STEP 6: User Taps Username                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User taps: john_smith                                      │
│              ↓                                               │
│  Navigate to: UserProfile(userId: 123)                      │
│              ↓                                               │
│  ┌────────────────────────────────────┐                    │
│  │  📱 John Smith's Profile            │                    │
│  ├────────────────────────────────────┤                    │
│  │  👤 John Smith                      │                    │
│  │  @john_smith                        │                    │
│  │                                     │                    │
│  │  Software Engineer | Tech Lover    │                    │
│  │                                     │                    │
│  │  [Follow] [Message]                 │                    │
│  │                                     │                    │
│  │  Posts: 142  Followers: 1.2K        │                    │
│  └────────────────────────────────────┘                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Real Examples

### Example 1: Post Caption
```
Input:  "Had a great time with @sarah and @mike at the beach! #summer"
         
Display: "Had a great time with sarah and mike at the beach! #summer"
                                 ^^^^^ purple, tappable
                                           ^^^^ purple, tappable
                                                              ^^^^^^^ gold, tappable
```

### Example 2: Comment
```
Input:  "@john this is amazing! You should see this @emma"
         
Display: "john this is amazing! You should see this emma"
          ^^^^ purple, tappable                      ^^^^ purple, tappable
```

### Example 3: Message
```
Input:  "Hey @team_lead can you review the PR? cc @developer1 @developer2"
         
Display: "Hey team_lead can you review the PR? cc developer1 developer2"
              ^^^^^^^^^ purple, tappable           ^^^^^^^^^^ purple, tappable
                                                              ^^^^^^^^^^ purple, tappable
```

### Example 4: Bio
```
Input:  "Software Engineer | Husband to @wife | Dad to @son and @daughter"
         
Display: "Software Engineer | Husband to wife | Dad to son and daughter"
                                         ^^^^ purple, tappable
                                                         ^^^ purple, tappable
                                                                 ^^^^^^^^ purple, tappable
```

## Color Scheme

- **@mentions (usernames)**: `#7c3aed` (Purple) - Primary color
- **#hashtags**: `#c4a35a` (Gold) - Secondary color
- **Regular text**: Default text color

## Interaction

- **Hover/Press**: Username highlights slightly
- **Tap**: Navigates to user profile
- **Long Press**: Could show quick preview card (future feature)

## Where It Works

✅ **Posts** - Caption and location tags
✅ **Comments** - Comment text
✅ **Replies** - Reply text
✅ **Messages** - Chat messages
✅ **Bio** - Profile bio
✅ **Family Posts** - Family moment captions
✅ **Stories** - Story captions
✅ **Anywhere** - Any text input in the app

## Technical Details

### Data Structure

```javascript
// When typing
mentions = [
  {
    id: 123,           // User ID
    username: "john",  // Username without @
    start: 4,          // Position in text
    end: 8             // End position
  },
  {
    id: 456,
    username: "sarah",
    start: 13,
    end: 18
  }
]

// Sent to backend
{
  caption: "Hey john and sarah!",
  mentions: [123, 456]  // Just the IDs
}

// Received from backend
{
  caption: "Hey john and sarah!",
  mentions: [
    {
      id: 123,
      username: "john",
      name: "John Smith",
      avatar_url: "..."
    },
    {
      id: 456,
      username: "sarah",
      name: "Sarah Johnson",
      avatar_url: "..."
    }
  ]
}
```

### Rendering Logic

```javascript
// ParsedText component
1. Receives text: "Hey john and sarah!"
2. Receives mentions: [{id: 123, username: "john", ...}, ...]
3. Finds "john" at position 4-8
4. Finds "sarah" at position 13-18
5. Renders:
   - "Hey " (normal)
   - "john" (purple, tappable → profile 123)
   - " and " (normal)
   - "sarah" (purple, tappable → profile 456)
   - "!" (normal)
```

## Notifications

When user is mentioned:

```
┌────────────────────────────────────┐
│  🔔 Notifications                   │
├────────────────────────────────────┤
│  👤 Sarah Johnson mentioned you     │
│     in a post                       │
│     "Hey john_smith how are you?"  │
│     2 minutes ago                   │
│                                     │
│  👤 Mike Davis mentioned you        │
│     in a comment                    │
│     "john_smith check this out!"   │
│     1 hour ago                      │
└────────────────────────────────────┘
```

Tapping notification → Goes to the post/comment where you were mentioned
