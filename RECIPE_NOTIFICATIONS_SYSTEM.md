# Family Recipe Notification & Interaction System

## Features Implemented

### 1. Recipe Notifications
When a family member adds a new recipe, all other family members receive a notification:
- **Notification Type**: `recipe`
- **Title**: "New Recipe: [Recipe Title]"
- **Message**: "[User Name] shared a new recipe"
- **Action**: Tapping notification navigates to recipe detail screen

### 2. Recipe Reactions
Family members can react to recipes with:
- ❤️ **Like** - Standard like reaction
- 😋 **Yum** - Food-specific reaction
- Reaction counts displayed on recipe cards and detail view
- Toggle reactions on/off by tapping again

**Backend Endpoints:**
- `POST /api/extras/recipes/{recipe_id}/react` - Add/remove reaction
- `GET /api/extras/recipes/{recipe_id}/reactions` - Get all reactions

### 3. Recipe Comments
Family members can comment on recipes:
- Add text comments
- View all comments with author info
- Comment count displayed on recipe
- Author receives notification when someone comments

**Backend Endpoints:**
- `POST /api/extras/recipes/{recipe_id}/comments` - Add comment
- `GET /api/extras/recipes/{recipe_id}/comments` - Get all comments

### 4. Recipe Detail View
Enhanced recipe detail screen with:
- Full recipe information (ingredients, instructions, prep time, servings)
- Reaction buttons with counts
- Comments section with modal
- Author information
- Recipe image

## Database Schema

### recipe_reactions
```sql
CREATE TABLE recipe_reactions (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES family_recipes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) DEFAULT 'like',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id, user_id)
);
```

### recipe_comments
```sql
CREATE TABLE recipe_comments (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES family_recipes(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Recipes
- `GET /api/extras/recipes` - List all family recipes
- `GET /api/extras/recipes/{id}` - Get single recipe
- `POST /api/extras/recipes` - Create recipe (sends notifications)
- `DELETE /api/extras/recipes/{id}` - Delete recipe

### Reactions
- `POST /api/extras/recipes/{id}/react` - Toggle reaction
  - Body: `{ "reaction_type": "like" | "love" | "yum" }`
  - Returns: `{ "reacted": true/false, "reaction_type": "..." }`
- `GET /api/extras/recipes/{id}/reactions` - Get all reactions

### Comments
- `POST /api/extras/recipes/{id}/comments` - Add comment
  - Body: `{ "text": "comment text" }`
  - Returns: `{ "comment": {...} }`
- `GET /api/extras/recipes/{id}/comments` - Get all comments

## Notification Flow

1. **User A** creates a recipe
2. Backend sends notifications to all family members (except User A)
3. **User B** receives notification in their notification center
4. **User B** taps notification → navigates to recipe detail
5. **User B** can react (like/yum) or comment
6. **User A** receives notification about reaction/comment

## Mobile UI Components

### Recipe Card
- Recipe image or placeholder emoji
- Title and author
- Prep time, servings, category
- Reaction and comment counts

### Recipe Detail Screen
- Full recipe view with image
- Reactions bar (heart, yum emoji, comment)
- Ingredients list with bullet points
- Instructions section
- Comments modal with input

### Comments Modal
- List of comments with avatars
- Comment input field
- Send button
- Real-time comment count updates

## Usage Example

```javascript
// React to a recipe
await api.post(`/extras/recipes/${recipeId}/react`, { 
  reaction_type: 'yum' 
});

// Add a comment
await api.post(`/extras/recipes/${recipeId}/comments`, { 
  text: 'This looks delicious!' 
});

// Load comments
const { data } = await api.get(`/extras/recipes/${recipeId}/comments`);
setComments(data.comments);
```

## Migration

Run migration to create tables:
```bash
python migrate_recipe_interactions.py
```

Or it runs automatically on deployment via Procfile.

## Future Enhancements

- [ ] Recipe ratings (1-5 stars)
- [ ] Save favorite recipes
- [ ] Share recipes outside family
- [ ] Recipe collections/cookbooks
- [ ] Cooking mode (step-by-step view)
- [ ] Ingredient shopping list
- [ ] Recipe variations/modifications
- [ ] Photo reviews (upload photo of cooked dish)
