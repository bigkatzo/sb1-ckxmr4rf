# Temporary Changes - Notes and Free Notes Fields

## Current Status
As of [Current Date], the notes and free notes functionality in the product form has been temporarily disabled due to RLS (Row Level Security) issues. This is a temporary solution until the RLS policies are properly configured and tested.

## Affected Components
1. `src/components/merchant/forms/ProductForm/ProductBasicInfo.tsx`
   - Removed notes and free notes input fields from the UI
   - Kept state variables but removed their setters and update logic
   - Removed `handleNotesChange` function
   - Removed entire notes section from the form

2. `src/services/products.ts`
   - Modified `updateProduct` function to ignore notes and free notes fields
   - Commented out notes and free notes processing in update data

3. `src/services/products/index.ts`
   - Modified `createProduct` function to ignore notes and free notes fields
   - Commented out notes processing in product data

## Required Fixes
1. RLS Configuration
   - Review and update RLS policies for the products table
   - Ensure proper access control for notes and free notes fields
   - Test RLS policies with different user roles

2. Component Restoration
   - Restore notes and free notes input fields in `ProductBasicInfo.tsx`
   - Re-enable state management for notes and free notes
   - Restore `handleNotesChange` function
   - Re-add notes section to the form

3. Service Layer Updates
   - Uncomment notes and free notes processing in `updateProduct`
   - Uncomment notes processing in `createProduct`
   - Add proper error handling for notes-related operations

4. Testing Requirements
   - Test notes and free notes creation
   - Test notes and free notes updates
   - Verify RLS policies are working correctly
   - Test with different user roles and permissions

## Data Structure
The notes and free notes fields follow this structure:
```typescript
notes: {
  shipping?: string;
  quality?: string;
  returns?: string;
}
freeNotes?: string;
```

## Related Components
- `ProductNotes.tsx` - Displays notes in the product view
- `ProductModal.tsx` - Uses notes in the product modal
- `ProductForm.tsx` - Main form component that includes notes functionality

## Future Considerations
1. Consider adding validation for notes fields
2. Consider adding character limits for notes
3. Consider adding rich text support for notes
4. Consider adding markdown support for notes

## Rollback Plan
If issues arise with this temporary solution:
1. Revert the changes in the affected files
2. Restore the original notes functionality
3. Implement alternative RLS solutions if needed

## Dependencies
- Supabase RLS policies
- Product form components
- Product service layer
- Database schema for products table

## Notes
- This is a temporary solution and should be revisited once RLS issues are resolved
- The state management for notes is still present in components but not actively used
- Existing notes data in the database remains unchanged
- The UI will not display or allow editing of notes until this is fixed 