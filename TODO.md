## StoryCard Backend Integration Plan

**Information Gathered:**

- Story model: to_dict() has like_count/comment_count/repost_count
- Routes: /feed returns liked_by_me/saved_by_me flags ✓, toggle like/save/comment/delete work
- StoryCard: Syntax broken from previous edits (\\n, em-dashes), dummy state, needs real API

**Plan:**

1. **Fix StoryCard.js syntax + wire all buttons** (main)
   - Initialize liked = story.liked_by_me, saved = story.saved_by_me
   - Like toggle → API POST /like → optimistic UI + refresh onUpdate
   - Save toggle → API POST /save → optimistic UI
   - Comment POST + list from story.comments
   - 3-dots: Delete (owner), Save toggle, Share, Repost (+count), Report
2. **Backend**: Feed already good, add report endpoint if missing

**Dependent Files:**

- mobile/src/components/StoryCard.js (fix + connect)

**Followup:**

- cd mobile && npx expo start --clear
- Test FeedScreen buttons persist, one like/user, 3-dots work

<ask_followup_question>Ready to fix StoryCard.js syntax and connect all buttons to real backend APIs?</ask_followup_question>
