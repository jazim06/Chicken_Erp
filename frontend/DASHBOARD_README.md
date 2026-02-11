# Supplier Dashboard - Implementation Guide

## Overview
The Supplier Dashboard is a fully editable, 3-column data management interface that matches the design specifications exactly. All numeric values are editable inline, and new entries can be added dynamically.

## File Locations

### Core Dashboard Files
- **Main Page**: `/app/frontend/src/pages/SupplierDashboardPage.jsx`
- **Inline Edit Component**: `/app/frontend/src/components/InlineEdit.jsx`
- **Add Entry Modal**: `/app/frontend/src/components/AddEntryModal.jsx`
- **API Adapter**: `/app/frontend/src/utils/apiAdapter.js`
- **Seed Data**: `/app/frontend/src/data/seedData.js`

### Sub-Party Management Files
- **Supplier Management Page**: `/app/frontend/src/pages/SupplierManagementPage.jsx`
- **Sub-Party List Component**: `/app/frontend/src/components/SubPartyList.jsx`

## Features

### 1. Inline Editing
All numeric cells in the dashboard are editable:

**How It Works:**
- Click any numeric value to enter edit mode
- An input field appears with the current value selected
- Enter new value and press Enter to save (or Esc to cancel)
- Blur event also triggers save
- Toast notification confirms successful update

**Implementation Details:**
```jsx
<InlineEdit
  value={row.a}
  onSave={(val) => handleUpdateEntry('supplier', supplier.id, { rowId: row.id, column: 'a' }, val)}
  type="number"
  decimals={3}
  className="justify-end"
/>
```

**Supported Fields:**
- Supplier table values (A, B, C columns)
- Other Calculations values
- Totals Overview amounts
- Financial Breakdown amounts

### 2. Add New Entries
The "+ Add New" button in the header opens a modal to create new entries.

**Entry Types:**
1. **Supplier Entry**: Add a new party to Joseph or Sadiq with A/B/C values
2. **Other Calculation**: Add a new item to the Other Calculations section
3. **Financial Entry**: Add a new amount to the Financial Breakdown

**Modal Fields:**
- Entry Type selector
- Conditional fields based on type
- Validation for required fields
- Auto-calculation of totals on save

### 3. Sub-Party Management

**Add Sub-Party:**
- Click "Add Party" button in Sub-Parties section
- Enter party name in the inline form
- Press Enter or click "Add" to save
- New party appears in the list with 0.000 kg weight

**Delete Sub-Party:**
- Hover over a sub-party row
- Click the trash icon that appears
- Confirm deletion in the dialog
- Party is removed from the list

### 4. Real-Time Calculations

The dashboard automatically recalculates totals when values change:

**Calculated Values:**
- Supplier totals (sum of C column for each supplier)
- Other Calculations total
- Subtotal (sum of all parties in Totals Overview)
- Total Balance (same as subtotal)
- Grand Total (sum of all financial amounts)

## API Adapter Methods

### Dashboard Operations
```javascript
// Get dashboard data
getDashboardData(supplierId)

// Update existing entry
updateDashboardEntry(type, id, field, value)
// type: 'supplier' | 'other' | 'totals' | 'financial'

// Create new entry
createDashboardEntry(type, data)

// Delete entry
deleteDashboardEntry(type, id)
```

### Sub-Party Operations
```javascript
// Add new sub-party
addSubParty(supplierId, partyName)

// Delete sub-party
deleteSubParty(supplierId, subPartyId)
```

## Data Structure

### Dashboard Data Format
```javascript
{
  suppliers: [
    {
      id: 'joseph',
      name: 'Joseph',
      rows: [
        { id: 'j1', party: 'RMS', a: 491.9, b: 150.3, c: 341.600 }
      ]
    }
  ],
  otherCalculations: {
    title: 'Section F',
    items: [
      { id: 'o1', name: 'Anas', value: 12.000 }
    ]
  },
  totalsOverview: [
    { id: 't1', party: 'Joseph', total: 993.700, highlight: false }
  ],
  financial: [
    { id: 'f1', name: 'RMS', amount: 73700, highlight: false }
  ]
}
```

## Styling and Design

### Layout
- **Container**: max-width 1280px, centered
- **Grid**: CSS Grid with 3 equal columns (`grid-template-columns: repeat(3, minmax(260px, 1fr))`)
- **Gap**: 24px between columns
- **Card Padding**: 20px (p-5)

### Typography
- **Headings**: Oswald font, 14px, bold, uppercase, 0.6px letter-spacing
- **Body**: Inter font, 14-16px
- **Numbers**: Tabular nums, 3 decimal places for weights

### Colors
- **Background**: #f6f7f9
- **Cards**: White with soft shadow
- **Primary Orange**: #f57c00
- **Success Green**: #17b978
- **Navy Gradient**: For stat bars
- **Blue Highlight**: Light blue for highlighted rows

### Interactive States
- **Hover**: Subtle bg-accent/30 on editable cells
- **Focus**: Orange ring on inputs
- **Transitions**: 0.25s cubic-bezier(0.4, 0, 0.2, 1)

## Responsive Behavior

### Desktop (>1280px)
- 3-column layout
- All features visible
- Inline editing with full keyboard support

### Tablet (768px - 1280px)
- Grid may wrap to 2 columns or stack
- Modal remains centered
- Touch-friendly targets (44px minimum)

### Mobile (<768px)
- Single column stack
- Modal becomes bottom sheet
- Add New button remains accessible
- Inline editing optimized for touch

## Swapping with Real API

To connect to a real backend:

1. **Update API Adapter** (`/app/frontend/src/utils/apiAdapter.js`):
```javascript
// Replace Promise-based stubs with actual API calls
export const getDashboardData = async (supplierId) => {
  const response = await fetch(`${API_URL}/dashboard/${supplierId}`);
  return response.json();
};

export const updateDashboardEntry = async (type, id, field, value) => {
  const response = await fetch(`${API_URL}/dashboard/${type}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ field, value })
  });
  return response.json();
};
```

2. **Add Environment Variable**:
```env
REACT_APP_API_URL=https://your-api.com/api
```

3. **Update Error Handling**:
- Add proper error responses
- Implement retry logic
- Add loading states

## Testing

### Unit Tests
```javascript
// Test inline edit save
it('should update value on save', async () => {
  const onSave = jest.fn();
  render(<InlineEdit value={100} onSave={onSave} />);
  // Click to edit, change value, save
  // Assert onSave called with new value
});

// Test total calculations
it('should recalculate totals on update', () => {
  // Update a supplier value
  // Assert total balance updates
});
```

### Integration Tests
- Test full add entry flow
- Verify real-time calculation updates
- Test sub-party add/delete operations

## Performance Considerations

### Optimization Techniques
1. **Debounced Inline Edits**: Prevent excessive API calls
2. **Optimistic Updates**: Update UI immediately, sync in background
3. **Memoization**: Use React.memo for table rows
4. **Virtual Scrolling**: For tables with >50 rows

### Current Limitations
- All data loaded at once (works for <1000 rows)
- No pagination (add if data grows)
- No real-time sync (add WebSocket if needed)

## Accessibility

### Keyboard Navigation
- Tab through all editable cells
- Enter to edit, Esc to cancel
- Arrow keys for table navigation (can be added)

### Screen Reader Support
- aria-labels on all interactive elements
- Role attributes for tables
- Live region announcements for updates

### Visual Accessibility
- WCAG AA contrast ratios met
- Focus indicators visible
- Touch targets ≥44px

## Maintenance

### Adding New Columns
1. Update `seedData.js` with new field
2. Add column header in SupplierDashboardPage
3. Add InlineEdit component for new field
4. Update calculation logic if needed

### Adding New Sections
1. Create new card in appropriate column
2. Add data structure to seedData
3. Implement inline editing
4. Add to API adapter methods

### Debugging
- Check browser console for errors
- Verify data structure matches expected format
- Test API adapter methods in isolation
- Use React DevTools to inspect state

## Support

For issues or questions:
1. Check console logs for errors
2. Verify seed data structure
3. Test API adapter methods independently
4. Review component props and state flow
