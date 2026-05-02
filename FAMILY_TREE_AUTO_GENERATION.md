# Family Tree - Automatic Generation Feature

## Overview
The Family Tree now supports **automatic generation** from your family members with a single tap. No more manual entry - the system intelligently creates a visual family tree from your existing family group.

## Features

### 🚀 One-Tap Auto-Generation
- **Flash Icon Button**: Tap the lightning bolt icon to instantly generate your family tree
- **Smart Placement**: System automatically organizes members by generation
- **Role-Based Hierarchy**: Admins are placed in parent generation (-1), others in current generation (0)
- **Visual Feedback**: Blue info banner shows when tree is auto-generated

### 👥 Intelligent Member Mapping
- **All Members Included**: Every family member gets a node in the tree
- **Profile Integration**: Nodes link to actual user profiles with avatars
- **Current User Highlight**: Your node is labeled "You" for easy identification
- **Relationship Labels**: Default labels assigned, customizable later

### 🔗 Interactive Relationship Building
- **Set Parent**: Tap any node → "Set Parent" to establish parent-child relationships
- **Add Children**: Tap node → "Add Child" to create descendant nodes
- **Generation Auto-Adjust**: Setting a parent automatically adjusts generation levels
- **Partner Linking**: Backend supports partner relationships (reciprocal)

### 🎨 Visual Design
- **Generation Colors**: Each generation has a unique color
  - `-2` (Great Grandparents): Orange `#f59e0b`
  - `-1` (Grandparents): Blue `#3b82f6`
  - `0` (Parents/You): Purple `#7c3aed`
  - `1` (Children): Green `#10b981`
  - `2` (Grandchildren): Pink `#ec4899`
- **Hexagonal Avatars**: Distinctive node shapes with profile pictures
- **Connector Lines**: Visual links between generations
- **Deceased Badge**: ✝ symbol for deceased members

## How to Use

### Initial Setup (Empty Tree)
1. Navigate to **Family Screen** → Tap **Tree** quick access button
2. See empty state with two options:
   - **Auto-Generate Tree** (recommended): Lightning bolt button
   - **Add Manually**: Plus icon for manual entry

### Auto-Generation Process
1. Tap **"Auto-Generate Tree"** button
2. System fetches all family members from your family group
3. Creates tree nodes automatically:
   - Admins → Parent generation
   - Current user → Current generation (labeled "You")
   - Other members → Current generation
4. Success message shows: "Generated tree with X members"
5. Blue info banner appears: "Auto-generated tree. Tap members to set relationships."

### Building Relationships
1. **Tap any node** to see options:
   - **Add Child**: Create a new child node
   - **Set Parent**: Choose from existing members in older generations
   - **View Profile**: Navigate to member's profile (if linked to user)
   - **Remove**: Delete node from tree

2. **Setting a Parent**:
   - System shows list of potential parents (older generations)
   - Select parent → Generation automatically adjusts
   - Parent-child link established

3. **Adding Children**:
   - Opens modal to add new family member
   - Child automatically placed in next generation
   - Can add deceased members with death dates

### Manual Additions
- Tap **+** button in header to add members manually
- Fill in details:
  - Full Name (required)
  - Relationship (Father, Mother, Son, Daughter, etc.)
  - Birth Year (optional)
  - Deceased status & death year
- Choose parent node to establish hierarchy

## Backend Endpoints

### Auto-Generate Tree
```
POST /extras/tree/auto-generate
```
**Response:**
```json
{
  "nodes": [
    {
      "id": 1,
      "user_id": 123,
      "display_name": "John Doe",
      "display_avatar": "https://...",
      "relationship_label": "You",
      "generation": 0,
      "parent_node_id": null,
      "is_deceased": false
    }
  ],
  "message": "Generated tree with 5 members"
}
```

### Set Parent Relationship
```
POST /extras/tree/{node_id}/set-parent
Body: { "parent_node_id": 2 }
```
- Establishes parent-child link
- Auto-adjusts child's generation to parent.generation + 1

### Set Partner Relationship
```
POST /extras/tree/{node_id}/set-partner
Body: { "partner_node_id": 3 }
```
- Creates reciprocal partner link
- Aligns both partners to same generation

### Get Tree
```
GET /extras/tree
```
Returns all nodes for current user's family

### Add Node Manually
```
POST /extras/tree
Body: {
  "display_name": "Jane Doe",
  "relationship_label": "Mother",
  "generation": -1,
  "parent_node_id": null,
  "birth_date": "1965-01-01",
  "is_deceased": false
}
```

### Delete Node
```
DELETE /extras/tree/{node_id}
```
- Clears partner relationships
- Removes parent references from children
- Deletes node

## Database Schema

### FamilyTreeNode Model
```python
class FamilyTreeNode(db.Model):
    id = Integer (Primary Key)
    family_id = Integer (Foreign Key → families.id)
    user_id = Integer (Foreign Key → users.id, nullable)
    display_name = String(100)
    display_avatar = String(300)
    birth_date = Date
    death_date = Date
    is_deceased = Boolean
    relationship_label = String(50)  # "Father", "Mother", etc.
    parent_node_id = Integer (Self-referential FK)
    partner_node_id = Integer (Self-referential FK)
    generation = Integer  # -2, -1, 0, 1, 2
    created_at = DateTime
```

## UI Components

### Empty State
- Large gradient icon (git-network-outline)
- Title: "Build Your Family Tree"
- Subtitle: "Auto-generate from family members or add manually"
- Primary button: "Auto-Generate Tree" (lightning bolt)
- Secondary button: "Add Manually" (plus icon)

### Header
- Back button
- Title: "Family Tree"
- Lightning bolt button (visible when tree is empty)
- Plus button (always visible)

### Tree Node Card
- Hexagonal avatar (52x52)
- Display name (11px, bold)
- Relationship label (10px, colored by generation)
- Birth year (9px, muted)
- Deceased badge (✝ symbol if applicable)
- Border color matches generation

### Generation Row
- Generation label with dot indicator
- Horizontal scroll of nodes
- Add node button (dashed border)
- Connector line to next generation

### Auto-Generated Notice
- Blue info icon
- Text: "Auto-generated tree. Tap members to set relationships."
- Light blue background with border

## User Flow

```
1. User opens Family Tree screen
   ↓
2. Sees empty state with auto-generate option
   ↓
3. Taps "Auto-Generate Tree"
   ↓
4. System creates nodes for all family members
   ↓
5. Tree displays with all members in default generations
   ↓
6. User taps nodes to set parent relationships
   ↓
7. Generations auto-adjust based on relationships
   ↓
8. User adds deceased ancestors manually
   ↓
9. Complete family tree with proper hierarchy
```

## Benefits

### For Users
- **Instant Setup**: No tedious manual entry
- **Visual Organization**: See family structure at a glance
- **Easy Editing**: Tap to modify relationships
- **Profile Integration**: Direct links to family member profiles
- **Historical Records**: Add deceased members with dates

### For Admins
- **Quick Onboarding**: New families can set up trees immediately
- **Flexible Structure**: Support for complex family relationships
- **Data Integrity**: Automatic generation ensures all members included
- **Scalability**: Works with families of any size

## Technical Details

### Generation Logic
```javascript
// Auto-generation assigns:
- Admin (not current user) → generation = -1 (parents)
- Current user → generation = 0 (self)
- Other members → generation = 0 (siblings/peers)

// When setting parent:
child.generation = parent.generation + 1
```

### Relationship Cleanup
When deleting a node:
1. Clear partner's partner_node_id (if exists)
2. Set all children's parent_node_id to null
3. Delete the node

### State Management
```javascript
const [nodes, setNodes] = useState([]);
const [autoGenerated, setAutoGenerated] = useState(false);
const [selectedParent, setSelectedParent] = useState(null);
const [showAdd, setShowAdd] = useState(false);
```

## Future Enhancements

### Planned Features
- [ ] Drag-and-drop node repositioning
- [ ] Zoom and pan for large trees
- [ ] Export tree as image/PDF
- [ ] Import from GEDCOM files
- [ ] DNA connection indicators
- [ ] Timeline view of family events
- [ ] Collaborative editing with real-time sync
- [ ] AI-suggested relationships based on names/ages
- [ ] Photo galleries per node
- [ ] Family tree sharing with privacy controls

### Advanced Relationships
- [ ] Multiple partners (remarriage)
- [ ] Adopted children indicators
- [ ] Step-family relationships
- [ ] Godparents and guardians
- [ ] Extended family (cousins, aunts, uncles)

## Troubleshooting

### Tree Not Generating
- **Issue**: "No family members found" error
- **Solution**: Ensure you're in a family group with other members

### Missing Members
- **Issue**: Some family members don't appear
- **Solution**: Check they're active members in family group, not just invited

### Wrong Generation
- **Issue**: Member in wrong generation level
- **Solution**: Tap node → Set Parent to establish correct hierarchy

### Can't Set Parent
- **Issue**: "No Parents" alert appears
- **Solution**: Add members from older generations first (use manual add)

## Code Locations

### Frontend
- **Screen**: `mobile/src/screens/FamilyTreeScreen.js`
- **Components**: TreeNode, AddNodeModal
- **Styles**: Inline StyleSheet at bottom of file

### Backend
- **Routes**: `backend/routes/extras_routes.py`
- **Model**: `backend/models/extras.py` (FamilyTreeNode)
- **Endpoints**: Lines 27-200 in extras_routes.py

## Testing Checklist

- [ ] Auto-generate creates nodes for all family members
- [ ] Current user labeled as "You"
- [ ] Admins placed in parent generation
- [ ] Tap node shows action menu
- [ ] Set parent establishes relationship
- [ ] Generation auto-adjusts after setting parent
- [ ] Add child creates node in next generation
- [ ] Delete node clears relationships
- [ ] Manual add still works
- [ ] Profile navigation works for linked users
- [ ] Deceased badge displays correctly
- [ ] Empty state shows both options
- [ ] Success/error messages display
- [ ] Tree persists after app restart

## Summary

The automatic family tree generation feature transforms the tedious process of building a family tree into a one-tap experience. Users can instantly visualize their family structure, then refine relationships interactively. The system intelligently organizes members by generation and provides intuitive tools for establishing parent-child and partner relationships.

**Key Innovation**: Instead of starting from scratch, users leverage their existing family group to auto-populate the tree, then enhance it with historical data and relationship details.
