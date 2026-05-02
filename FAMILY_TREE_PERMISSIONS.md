# Family Tree - Role-Based Permissions

## Summary
Implemented role-based access control for the family tree feature. All family members can view the tree, but only admins can create, edit, or delete nodes.

## Changes Made

### Frontend (FamilyTreeScreen.js)

#### 1. Role Detection
```javascript
const [myRole, setMyRole] = useState('member');

const fetchTree = useCallback(async () => {
  // Fetch tree nodes
  const { data } = await api.get('/extras/tree');
  
  // Fetch user's role
  const familyData = await api.get('/family/my-family');
  const members = familyData.data.members || [];
  const me = members.find(m => m.id === user?.id);
  setMyRole(me?.role || 'member');
}, [user]);
```

#### 2. Header Updates
- **Admin View**: Shows both auto-generate (⚡) and add (+) buttons
- **Non-Admin View**: Shows "View Only" subtitle, no edit buttons

```javascript
<View style={{ flex: 1 }}>
  <AppText style={headerTitle}>Family Tree</AppText>
  {myRole !== 'admin' && (
    <AppText style={headerSubtitle}>View Only</AppText>
  )}
</View>
{myRole === 'admin' && (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {/* Edit buttons */}
  </View>
)}
```

#### 3. Empty State
- **Admin**: Shows auto-generate and manual add options
- **Non-Admin**: Shows message "Ask your family admin to create the tree"

#### 4. View-Only Banner
Non-admins see a gray banner at the top:
```
👁 View-only mode. Only admins can edit the tree.
```

#### 5. Node Interactions
**Admin Actions:**
- Add Child
- Set Parent
- View Profile
- Remove

**Non-Admin Actions:**
- View Profile only
- No edit/delete options

```javascript
onPress={(n) => {
  if (myRole !== 'admin') {
    // View-only: just show info
    Alert.alert(
      n.display_name,
      n.relationship_label || 'Family member',
      [
        n.user_id ? { text: 'View Profile', ... } : null,
        { text: 'Close', style: 'cancel' },
      ].filter(Boolean)
    );
    return;
  }
  
  // Admin: full edit options
  // ...
}}
```

#### 6. Permission Checks
All mutation functions check role before executing:

```javascript
const autoGenerateTree = useCallback(async () => {
  if (myRole !== 'admin') {
    error('Only admins can generate the family tree');
    return;
  }
  // ... proceed with generation
}, [myRole]);

const addNode = async (nodeData) => {
  if (myRole !== 'admin') {
    error('Only admins can add members to the tree');
    return;
  }
  // ... proceed with adding
};

const deleteNode = (node) => {
  if (myRole !== 'admin') {
    error('Only admins can remove members from the tree');
    return;
  }
  // ... proceed with deletion
};
```

#### 7. UI Element Visibility
- **Add Node Button** (dashed border): Hidden for non-admins
- **Add Generation Button**: Hidden for non-admins
- **Long Press Delete**: Disabled for non-admins

### Backend (extras_routes.py)

#### Permission Validation Helper
All mutation endpoints now validate admin role:

```python
from models.family import FamilyMember

# Check if user is admin
member = FamilyMember.query.filter_by(
    user_id=user.id, 
    family_id=user.family_id
).first()

if not member or member.role != 'admin':
    return jsonify({"error": "Only admins can modify the tree"}), 403
```

#### Protected Endpoints

1. **POST /extras/tree/auto-generate**
   - Error: "Only admins can generate the family tree"

2. **POST /extras/tree**
   - Error: "Only admins can add members to the tree"

3. **POST /extras/tree/{node_id}/set-parent**
   - Error: "Only admins can modify the tree"

4. **PUT /extras/tree/{node_id}**
   - Error: "Only admins can modify the tree"

5. **POST /extras/tree/{node_id}/set-partner**
   - Error: "Only admins can modify the tree"

6. **DELETE /extras/tree/{node_id}**
   - Error: "Only admins can remove members from the tree"

#### Read-Only Endpoint
**GET /extras/tree** - No permission check, all members can view

## User Experience

### Admin Experience
1. Opens Family Tree screen
2. Sees "Family Tree" title with edit buttons
3. Can tap ⚡ to auto-generate tree
4. Can tap + to add members manually
5. Tapping nodes shows full action menu
6. Can set relationships, add children, remove members
7. Long press to quickly delete nodes

### Non-Admin Experience
1. Opens Family Tree screen
2. Sees "Family Tree" title with "View Only" subtitle
3. No edit buttons in header
4. Gray banner: "View-only mode. Only admins can edit the tree."
5. Tapping nodes only shows "View Profile" or "Close"
6. Cannot add, edit, or delete nodes
7. Empty state shows: "Ask your family admin to create the tree"

## Error Messages

### Frontend Errors
- "Only admins can generate the family tree"
- "Only admins can add members to the tree"
- "Only admins can remove members from the tree"

### Backend Errors (403 Forbidden)
- "Only admins can generate the family tree"
- "Only admins can add members to the tree"
- "Only admins can modify the tree"
- "Only admins can remove members from the tree"

## Visual Indicators

### Admin View
```
┌─────────────────────────────────────┐
│ ← Family Tree              ⚡  +    │
├─────────────────────────────────────┤
│ ℹ️ Auto-generated tree. Tap...     │
│                                     │
│ [Generation -1: Grandparents]       │
│ ┌────┐ ┌────┐ ┌────┐ [+]          │
│ │👤  │ │👤  │ │👤  │              │
│ └────┘ └────┘ └────┘              │
│                                     │
│ [+ Add Another Generation]          │
└─────────────────────────────────────┘
```

### Non-Admin View
```
┌─────────────────────────────────────┐
│ ← Family Tree                       │
│   View Only                         │
├─────────────────────────────────────┤
│ 👁 View-only mode. Only admins...  │
│                                     │
│ [Generation -1: Grandparents]       │
│ ┌────┐ ┌────┐ ┌────┐              │
│ │👤  │ │👤  │ │👤  │              │
│ └────┘ └────┘ └────┘              │
│                                     │
│ (No add buttons)                    │
└─────────────────────────────────────┘
```

## Security Benefits

1. **Data Integrity**: Prevents accidental or malicious tree modifications
2. **Clear Ownership**: Only admins manage family structure
3. **Audit Trail**: All changes traceable to admin users
4. **Role Separation**: View vs. edit permissions clearly defined
5. **Backend Validation**: Frontend checks backed by server-side enforcement

## Testing Checklist

- [x] Admin can auto-generate tree
- [x] Admin can add nodes manually
- [x] Admin can set parent relationships
- [x] Admin can delete nodes
- [x] Admin sees all edit buttons
- [x] Non-admin sees "View Only" badge
- [x] Non-admin sees view-only banner
- [x] Non-admin cannot auto-generate
- [x] Non-admin cannot add nodes
- [x] Non-admin cannot delete nodes
- [x] Non-admin can view profiles
- [x] Non-admin sees appropriate empty state
- [x] Backend rejects non-admin mutations
- [x] Error messages display correctly
- [x] Role fetched on screen load
- [x] Permissions persist across navigation

## Future Enhancements

### Potential Role Additions
- **Editor**: Can edit but not delete
- **Contributor**: Can add but not edit/delete
- **Viewer**: Read-only (current non-admin behavior)

### Advanced Permissions
- Node-level permissions (owner can edit their own node)
- Temporary edit access grants
- Permission inheritance (sub-admins)
- Audit log of all tree modifications

## Code Locations

### Frontend
- **File**: `mobile/src/screens/FamilyTreeScreen.js`
- **Lines**: 
  - Role state: ~152
  - Role fetch: ~155-165
  - Permission checks: ~168-195, ~240-290
  - UI conditionals: ~240-260, ~280-320

### Backend
- **File**: `backend/routes/extras_routes.py`
- **Lines**:
  - Auto-generate: ~27-80
  - Add node: ~95-125
  - Set parent: ~128-150
  - Update node: ~153-170
  - Set partner: ~173-200
  - Delete node: ~203-220

## Migration Notes

### Existing Trees
- No data migration needed
- Existing trees remain accessible
- All members can view immediately
- Only admins can edit going forward

### Role Assignment
- Family creators are automatically admins
- Additional admins can be promoted via Family Members screen
- Default role for new members: "member"

## Summary

This implementation provides a robust permission system for the family tree feature. Admins have full control over tree structure while all members can view and explore their family history. The dual-layer validation (frontend + backend) ensures security while maintaining a smooth user experience.

**Key Achievement**: Balanced accessibility with control - everyone can see their family tree, but only trusted admins can modify it.
