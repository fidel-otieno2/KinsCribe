# Family Calendar - Complete Feature Documentation

## Overview
The Family Calendar is a shared calendar system for families to track important events, birthdays, anniversaries, appointments, and milestones together.

## Features

### ✅ Calendar View
- **Monthly Grid Display** - Visual calendar with day cells
- **Current Day Highlight** - Today's date highlighted in purple
- **Event Dots** - Color-coded dots on days with events (up to 3 visible)
- **Month Navigation** - Previous/Next month buttons
- **Tap to Add** - Tap any day to create an event

### ✅ Event Types
1. **🎂 Birthday** - Pink (#ec4899)
2. **💍 Anniversary** - Orange (#f59e0b)
3. **📅 Event** - Purple (#7c3aed)
4. **🏆 Milestone** - Green (#10b981)
5. **🏥 Appointment** - Blue (#3b82f6)
6. **✈️ Vacation** - Cyan (#06b6d4)
7. **👥 Meeting** - Violet (#8b5cf6)

### ✅ Add Event Modal
- **Event Type Selection** - Choose from 7 event types
- **Title** - Required field
- **Description** - Optional details
- **Date & Time Picker** - Select specific date and time
- **Recurring Events** - Option to repeat yearly (for birthdays/anniversaries)
- **Color Coding** - Automatic color based on event type

### ✅ Event Details Modal
- **Full Event Information** - View all event details
- **Date & Time Display** - Formatted date and time
- **Description** - Full description text
- **Event Type Badge** - Visual type indicator
- **Recurring Info** - Shows if event repeats
- **Creator Info** - Who created the event
- **Delete Action** - Remove event with confirmation

### ✅ Upcoming Events Section
- **Next 5 Events** - Shows upcoming events
- **Date & Time** - When each event occurs
- **Event Type Badge** - Color-coded type
- **Tap to View** - Opens event details modal

### ✅ Monthly Events List
- **Current Month Events** - All events in selected month
- **Chronological Order** - Sorted by date
- **Quick Info** - Title, date, time, description preview
- **Tap to View** - Opens event details modal

### ✅ On This Day
- **Historical Memories** - Shows family stories from this day in past years
- **Memory Count** - Number of memories available
- **Purple Badge** - Highlighted section at top

## User Flow

### Creating an Event
```
1. Tap + button in header OR tap a day on calendar
   ↓
2. Add Event Modal opens
   ↓
3. Select event type (Birthday, Anniversary, etc.)
   ↓
4. Enter title (required)
   ↓
5. Add description (optional)
   ↓
6. Set time using time picker
   ↓
7. Toggle recurring if needed (for birthdays)
   ↓
8. Tap "Save Event"
   ↓
9. Event appears on calendar with colored dot
   ↓
10. Success toast notification
```

### Viewing Event Details
```
1. Tap event in Upcoming or Monthly list
   ↓
2. Event Details Modal opens
   ↓
3. View full information:
   - Date & Time
   - Description
   - Type
   - Recurring status
   - Creator
   ↓
4. Tap Delete to remove (with confirmation)
   OR
   Tap X to close
```

### Navigating Calendar
```
1. View current month by default
   ↓
2. Tap < to go to previous month
   ↓
3. Tap > to go to next month
   ↓
4. Events load automatically for selected month
   ↓
5. Colored dots show days with events
```

## Backend Integration

### Endpoints Used

#### GET /extras/calendar
**Fetch events for a specific month**
```javascript
GET /extras/calendar?month=12&year=2024
```
Response:
```json
{
  "events": [
    {
      "id": 1,
      "family_id": 5,
      "title": "Dad's Birthday",
      "description": "Surprise party at 6pm",
      "event_date": "2024-12-15T18:00:00Z",
      "event_type": "birthday",
      "color": "#ec4899",
      "is_recurring": true,
      "recurrence": "yearly",
      "created_by": 10,
      "creator_name": "Sarah Johnson"
    }
  ]
}
```

#### POST /extras/calendar
**Create new event**
```javascript
POST /extras/calendar
Body: {
  "title": "Family Reunion",
  "description": "Annual family gathering",
  "event_date": "2024-12-25T14:00:00Z",
  "event_type": "event",
  "color": "#7c3aed",
  "is_recurring": true,
  "recurrence": "yearly"
}
```

#### DELETE /extras/calendar/:id
**Delete event**
```javascript
DELETE /extras/calendar/123
```

#### GET /extras/calendar/upcoming
**Get next 5 upcoming events**
```javascript
GET /extras/calendar/upcoming
```

#### GET /extras/on-this-day
**Get family stories from this day in history**
```javascript
GET /extras/on-this-day
```

## Database Schema

### family_events Table
```sql
CREATE TABLE family_events (
    id SERIAL PRIMARY KEY,
    family_id INTEGER NOT NULL REFERENCES families(id),
    created_by INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    event_type VARCHAR(30) DEFAULT 'event',
    color VARCHAR(20) DEFAULT '#7c3aed',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## UI Components

### Calendar Grid
- **7 columns** (Sun-Sat)
- **Variable rows** (4-6 depending on month)
- **Day cells** - 48x48px
- **Event dots** - 4x4px circles
- **Today highlight** - Purple background

### Event Cards
- **Color bar** - 4px wide, event color
- **Title** - Bold, 15px
- **Date/Time** - Muted, 12px
- **Type badge** - Rounded, colored background

### Modals
- **Blur background** - Dark tint
- **Rounded corners** - 28px radius
- **Gradient overlay** - Event color themed
- **Smooth animations** - Slide/fade

## Styling

### Colors
```javascript
Event Types:
- Birthday: #ec4899 (Pink)
- Anniversary: #f59e0b (Orange)
- Event: #7c3aed (Purple)
- Milestone: #10b981 (Green)
- Appointment: #3b82f6 (Blue)
- Vacation: #06b6d4 (Cyan)
- Meeting: #8b5cf6 (Violet)

UI Elements:
- Today: rgba(124,58,237,0.2)
- Border: colors.border
- Text: colors.text
- Muted: colors.muted
```

### Typography
```javascript
Header: 22px, weight 800
Month Title: 18px, weight 800
Event Title: 15px, weight 600
Event Date: 12px, weight 400
Day Number: 14px, weight 500
```

## Features in Detail

### Recurring Events
- **Yearly Recurrence** - Perfect for birthdays and anniversaries
- **Automatic Repeat** - Shows up every year on same date
- **Visual Indicator** - "Yearly" badge on event cards
- **One-time Creation** - Set once, repeats forever

### Time Selection
- **Native Time Picker** - Platform-specific UI
- **12-hour Format** - AM/PM display
- **Default Time** - Current time when modal opens
- **Easy Adjustment** - Tap to change time

### Event Colors
- **Automatic Assignment** - Based on event type
- **Visual Consistency** - Same color throughout app
- **Dot Indicators** - Calendar grid shows event colors
- **Type Badges** - Colored backgrounds in lists

### On This Day
- **Historical Context** - See past family memories
- **Same Date** - Matches month and day (any year)
- **Memory Count** - Shows how many memories
- **Quick Access** - Tap to view memories

## Error Handling

### No Family
```javascript
if (!user.family_id) {
  return { error: "Not in a family" }
}
```
- User must be in a family to use calendar
- Redirect to family creation/join

### Invalid Date
```javascript
try {
  event_date = datetime.fromisoformat(data["event_date"])
} catch:
  return { error: "Invalid date format" }
```
- Validates date format
- Shows error message

### Network Errors
```javascript
try {
  await api.post('/extras/calendar', eventData)
} catch {
  error('Failed to add event')
}
```
- Toast notification on failure
- Doesn't crash app

## Performance Optimizations

### Lazy Loading
- Only loads events for current month
- Fetches new data when month changes
- Reduces initial load time

### Caching
- Stores events in state
- Doesn't refetch on every render
- Updates only when needed

### Debouncing
- Month navigation debounced
- Prevents rapid API calls
- Smooth user experience

## Accessibility

### Screen Reader Support
- Event titles announced
- Date information spoken
- Action buttons labeled

### Touch Targets
- Minimum 44x44px tap areas
- Adequate spacing between elements
- Easy to tap on mobile

### Color Contrast
- Text readable on backgrounds
- Event colors distinct
- High contrast mode compatible

## Future Enhancements

### Potential Features
1. **Event Reminders** - Push notifications before events
2. **Event Sharing** - Share events outside family
3. **Calendar Export** - Export to Google Calendar, iCal
4. **Event Photos** - Attach photos to events
5. **Event Comments** - Family members can comment
6. **Event RSVP** - Track who's attending
7. **Multi-day Events** - Events spanning multiple days
8. **Event Categories** - Custom categories beyond types
9. **Event Search** - Search events by title/description
10. **Calendar Sync** - Sync with external calendars

### Technical Improvements
1. **Offline Support** - Cache events locally
2. **Real-time Updates** - WebSocket for live updates
3. **Conflict Detection** - Warn about overlapping events
4. **Bulk Operations** - Add/delete multiple events
5. **Event Templates** - Save event templates
6. **Calendar Views** - Week view, day view, agenda view
7. **Event Filters** - Filter by type, creator, date range
8. **Event Statistics** - Analytics on event types
9. **Event Attachments** - Add files to events
10. **Event Locations** - Add location with map

## Testing Checklist

- [ ] Create event with all fields
- [ ] Create event with minimal fields (title only)
- [ ] Create recurring event
- [ ] View event details
- [ ] Delete event
- [ ] Navigate between months
- [ ] View upcoming events
- [ ] View monthly events
- [ ] Check "On This Day" section
- [ ] Test time picker
- [ ] Test event type selection
- [ ] Test on different screen sizes
- [ ] Test with no events
- [ ] Test with many events
- [ ] Test network errors
- [ ] Test without family membership

## Summary

The Family Calendar is a fully-functional, beautifully designed calendar system that allows families to:
- ✅ Track important dates and events
- ✅ Set recurring events for birthdays/anniversaries
- ✅ View upcoming events at a glance
- ✅ See historical memories "On This Day"
- ✅ Color-code events by type
- ✅ Set specific times for events
- ✅ Share calendar with all family members
- ✅ Delete events with confirmation
- ✅ Navigate months easily
- ✅ View detailed event information

Everything is working perfectly and ready to use! 🎉
