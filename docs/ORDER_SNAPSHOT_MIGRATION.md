# Order System Migration: Removing Product/Collection Delete Constraints

## Migration Overview
**File:** `migrations/20250505100000_remove_product_collection_constraints.sql`

This migration removes the restrictive delete constraints on the orders table for `product_id` and `collection_id` foreign keys, allowing products and collections to be deleted without affecting order history. 

## Problem Statement

The original database design had the following constraints:
- `orders.product_id` referenced `products(id)` with `ON DELETE RESTRICT/CASCADE`
- `orders.collection_id` referenced `collections(id)` with `ON DELETE RESTRICT/CASCADE`

This design prevented merchants from deleting products or collections that had associated orders, making cleanup and product management difficult.

## Solution

Rather than simply changing the constraints to `ON DELETE SET NULL` (which would lose product information), we implemented a comprehensive solution:

1. **Snapshot-based Architecture**
   - Added `product_snapshot` and `collection_snapshot` JSONB columns to store complete point-in-time data
   - Created a database trigger that automatically captures this data on order creation

2. **Remove Restrictive Constraints**
   - Dropped the existing foreign key constraints
   - Made `product_id` and `collection_id` columns nullable
   - Created LEFT JOINs in the views instead of inner joins

3. **Intelligent Fallback Logic**
   - Updated all views to use COALESCE and CASE expressions to seamlessly fallback to snapshot data
   - Used proper array and JSONB handling for complex fields like images

4. **View Preservation**
   - Maintained all existing view columns with identical names
   - Included complete snapshot objects for frontend compatibility
   
## Image Preservation Change

In addition to the database migration, we made the following change to improve reliability:

**File:** `src/services/collections/index.ts`

We modified the `deleteCollection` function to stop trying to delete collection images from storage. Now, when a collection is deleted:

1. The collection record is removed from the database
2. The collection images are preserved in storage
3. Order history continues to display these images via snapshots

This change provides several benefits:
- Eliminates storage-related errors during collection deletion
- Maintains a complete visual history of orders
- Preserves image assets that may be referenced in order snapshots
- Improves system reliability by removing a potential failure point

## Technical Details

### Database Changes
- Modified foreign key constraints to allow nulls
- Added snapshot columns and triggers
- Updated three views:
  - `user_orders` - For customer-facing order history
  - `merchant_orders` - For merchant dashboard
  - `public_order_counts` - For product statistics

### View Optimizations
- Improved image handling with array checks
- Enhanced type handling for JSONB conversion
- Added complete snapshots to view output for frontend compatibility

### Key Frontend Compatibility
- Preserved the ability to access images via `order.product_snapshot?.images?.[0]`
- Maintained all existing fields and data structures
- Ensured all filtering and display logic continues to work

## Testing
The migration was tested to ensure:
1. Orders remain visible after products/collections are deleted
2. Product images display correctly on order pages
3. Order tracking continues to function
4. Order history remains complete and accurate

## Advantages
1. **Data Integrity**: Complete product information is preserved even if products are deleted
2. **Flexibility**: Merchants can freely delete products without affecting order history
3. **Transparency**: Changes are invisible to frontend code, which continues to work unchanged
4. **Performance**: Views are optimized to handle both existing and deleted product scenarios

## Implementation Notes
- The trigger function captures complete product and collection data
- Existing orders were updated with snapshot data during migration
- All views were reconstructed with robust fallback logic
- RLS policies were preserved to maintain security

This approach is more comprehensive than a simple constraint change, ensuring that the complete order history remains intact and accessible even when products or collections are deleted. 