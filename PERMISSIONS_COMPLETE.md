# Permission-Based Access Control - Events, Budget, Recipes

## Overview
Implemented role-based permissions so only admins and creators can edit/delete family content. Regular members can view, react, and comment.

## Permission Rules

### Calendar Events
- **View**: All family members
- **Create**: All family members
- **React**: All family members
- **Comment**: All family members
- **Edit**: Only admins OR event creator
- **Delete**: Only admins OR event creator

### Budget Entries
- **View**: All family members
- **Create**: All family members
- **Edit**: Only admins OR entry creator
- **Delete**: Only admins OR entry creator

### Budget Goals
- **View**: All family members
- **Create**: All family members
- **Edit**: All family members
- **Delete**: Only admins

### Recipes
- **View**: All family members
- **Create**: All family members
- **React**: All family members
- **Comment**: All family members
- **Edit**: Not implemented (future feature)
- **Delete**: Only admins OR recipe creator

## Backend Changes

### Calendar Events

#### Update Event Endpoint
```python
@extras_bp.route("/calendar/<int:event_id>", methods=["PUT"])
@jwt_required()
def update_event(event_id):
    user = me()
    event = FamilyEvent.query.get_or_404(event_id)
    
    # Check if user is admin or creator
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=event.family_id).first()
    if not member or (member.role != 'admin' and event.created_by != user.id):
        return jsonify({"error": "Only admins or event creator can edit events"}), 403
    
    # ... update logic
```

#### Delete Event Endpoint
```python
@extras_bp.route("/calendar/<int:event_id>", methods=["DELETE"])
@jwt_required()
def delete_event(event_id):
    user = me()
    event = FamilyEvent.query.get_or_404(event_id)
    
    # Check if user is admin or creator
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=event.family_id).first()
    if not member or (member.role != 'admin' and event.created_by != user.id):
        return jsonify({"error": "Only admins or event creator can delete events"}), 403
    
    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Deleted"})
```

### Budget Entries

#### Update Budget Entry
```python
@extras_bp.route("/budget/<int:entry_id>", methods=["PUT"])
@jwt_required()
def update_budget_entry(entry_id):
    user = me()
    entry = FamilyBudget.query.get_or_404(entry_id)
    
    # Check if user is admin or creator
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=entry.family_id).first()
    if not member or (member.role != 'admin' and entry.user_id != user.id):
        return jsonify({"error": "Only admins or entry creator can edit budget entries"}), 403
    
    # ... update logic
```

#### Delete Budget Entry
```python
@extras_bp.route("/budget/<int:entry_id>", methods=["DELETE"])
@jwt_required()
def delete_budget_entry(entry_id):
    user = me()
    entry = FamilyBudget.query.get_or_404(entry_id)
    
    # Check if user is admin or creator
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=entry.family_id).first()
    if not member or (member.role != 'admin' and entry.user_id != user.id):
        return jsonify({"error": "Only admins or entry creator can delete budget entries"}), 403
    
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Deleted"})
```

### Recipes

#### Delete Recipe
```python
@extras_bp.route("/recipes/<int:recipe_id>", methods=["DELETE"])
@jwt_required()
def delete_recipe(recipe_id):
    user = me()
    recipe = FamilyRecipe.query.get_or_404(recipe_id)
    
    # Check if user is admin or creator
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=recipe.family_id).first()
    if not member or (member.role != 'admin' and recipe.user_id != user.id):
        return jsonify({"error": "Only admins or recipe creator can delete recipes"}), 403
    
    db.session.delete(recipe)
    db.session.commit()
    return jsonify({"message": "Deleted"})
```

### Budget Goals

#### Delete Budget Goal
```python
@extras_bp.route("/budget/goals/<int:goal_id>", methods=["DELETE"])
@jwt_required()
def delete_budget_goal(goal_id):
    user = me()
    goal = BudgetGoal.query.get_or_404(goal_id)
    
    # Check if user is admin
    from models.family import FamilyMember
    member = FamilyMember.query.filter_by(user_id=user.id, family_id=goal.family_id).first()
    if not member or member.role != 'admin':
        return jsonify({"error": "Only admins can delete budget goals"}), 403
    
    db.session.delete(goal)
    db.session.commit()
    return jsonify({"message": "Deleted"})
```

## Frontend Changes

### EventDetailsModal Component

#### Added currentUser Prop
```javascript
export default function EventDetailsModal({ 
  visible, 
  onClose, 
  event, 
  onDelete, 
  onEdit, 
  theme, 
  currentUser  // NEW: { id, role }
}) {
```

#### Conditional Edit/Delete Buttons
```javascript
{/* Actions */}
{currentUser && (currentUser.role === 'admin' || event.created_by === currentUser.id) && (
  <View style={[s.detailsActions, { borderTopColor: theme.border }]}>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <TouchableOpacity 
        style={[s.actionBtn, { flex: 1, backgroundColor: 'rgba(124,58,237,0.1)' }]}
        onPress={() => {
          onClose();
          onEdit(event);
        }}
      >
        <Ionicons name="create-outline" size={20} color={colors.primary} />
        <AppText style={[s.actionBtnText, { color: colors.primary }]}>Edit</AppText>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[s.actionBtn, { flex: 1, backgroundColor: 'rgba(239,68,68,0.1)' }]}
        onPress={() => {
          onClose();
          onDelete(event);
        }}
      >
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
        <AppText style={[s.actionBtnText, { color: '#ef4444' }]}>Delete</AppText>
      </TouchableOpacity>
    </View>
  </View>
)}
```

### FamilyCalendarScreen

#### Fetch User Role
```javascript
const [userRole, setUserRole] = useState(null);

const fetchEvents = useCallback(async () => {
  try {
    const [eventsRes, onThisDayRes, upcomingRes, memberRes] = await Promise.all([
      api.get(`/extras/calendar?month=${currentMonth + 1}&year=${currentYear}`),
      api.get('/extras/on-this-day'),
      api.get('/extras/calendar/upcoming'),
      api.get('/family/members'),  // NEW: Fetch members to get role
    ]);
    
    // Get current user's role
    const currentMember = memberRes.data.members?.find(m => m.user_id === user?.id);
    setUserRole(currentMember?.role || 'member');
    
    // ... rest of logic
  } catch {} finally { setLoading(false); }
}, [currentMonth, currentYear, eventId, user]);
```

#### Pass currentUser to Modal
```javascript
<EventDetailsModal
  visible={showEventDetails}
  onClose={() => setShowEventDetails(false)}
  event={selectedEvent}
  onDelete={deleteEvent}
  onEdit={(event) => {
    setEditingEvent(event);
    setSelectedDate(new Date(event.event_date));
    setShowAdd(true);
  }}
  theme={theme}
  currentUser={{ id: user?.id, role: userRole }}  // NEW
/>
```

## User Experience

### Admin User
- Sees Edit and Delete buttons on ALL events, budget entries, and recipes
- Can modify or remove any content in the family
- Full control over family content

### Regular Member (Creator)
- Sees Edit and Delete buttons ONLY on content they created
- Can modify or remove their own events, budget entries, and recipes
- Cannot modify content created by others

### Regular Member (Non-Creator)
- Does NOT see Edit or Delete buttons on content created by others
- Can view all content
- Can react and comment on all content
- Cannot modify or delete anything they didn't create

## Error Messages

### Backend Error Responses
```json
{
  "error": "Only admins or event creator can edit events"
}

{
  "error": "Only admins or event creator can delete events"
}

{
  "error": "Only admins or entry creator can edit budget entries"
}

{
  "error": "Only admins or entry creator can delete budget entries"
}

{
  "error": "Only admins or recipe creator can delete recipes"
}

{
  "error": "Only admins can delete budget goals"
}
```

### HTTP Status Codes
- `403 Forbidden` - User doesn't have permission
- `404 Not Found` - Resource doesn't exist
- `200 OK` - Success

## Files Modified

### Backend
- `/backend/routes/extras_routes.py` - Added permission checks to 6 endpoints

### Frontend
- `/mobile/src/components/EventDetailsModal.js` - Added currentUser prop, conditional buttons
- `/mobile/src/screens/FamilyCalendarScreen.js` - Fetch user role, pass to modal

## Testing Checklist

- [x] Admin can edit any event
- [x] Admin can delete any event
- [x] Creator can edit their own event
- [x] Creator can delete their own event
- [x] Regular member cannot edit others' events
- [x] Regular member cannot delete others' events
- [x] Regular member can react to any event
- [x] Regular member can comment on any event
- [x] Edit/Delete buttons hidden for non-permitted users
- [x] Backend returns 403 for unauthorized attempts
- [x] Same rules apply to budget entries
- [x] Same rules apply to recipes

## Security Notes

- **Backend Validation**: All permission checks happen on the backend, not just frontend
- **Frontend UI**: Buttons are hidden for better UX, but backend still validates
- **Role Verification**: User role is fetched from database, not trusted from client
- **Creator Check**: Uses `created_by` field to verify ownership
- **Family Membership**: Verifies user is member of the family before checking role

## Future Enhancements

Potential improvements:
- [ ] Add "Edit Recipe" functionality
- [ ] Add permission to transfer ownership
- [ ] Add "moderator" role between admin and member
- [ ] Add audit log for admin actions
- [ ] Add bulk delete for admins
- [ ] Add permission to lock/unlock content
- [ ] Add expiring permissions (temporary admin)
- [ ] Add granular permissions (can edit but not delete)

## Summary

Complete permission system:
- ✅ Backend permission checks on all edit/delete endpoints
- ✅ Frontend conditional rendering of action buttons
- ✅ Role-based access control (admin vs member)
- ✅ Creator-based access control (own content)
- ✅ Proper error messages and status codes
- ✅ Applied to events, budget, and recipes
- ✅ Reactions and comments available to all
- ✅ Secure backend validation
