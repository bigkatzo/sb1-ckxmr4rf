# End Sale Toggle Feature

## Overview

The End Sale Toggle feature allows merchants to control sales at multiple levels:

- **Collection-level toggle**: Ends sales for all products in a collection (existing functionality)
- **Category-level toggle**: Ends sales for all products in a category (new functionality)
- **Product-level toggle**: Ends sales for individual products (new functionality)

This provides granular control over which products are available for purchase.

## Implementation Details

### Database Changes

- Added `sale_ended` column to the `products` table
- Added `sale_ended` column to the `categories` table
- Created database functions to toggle the sale ended status at different levels
- Added the necessary indexes for performance optimization
- Updated database views to include the sale ended property for products and categories

### Code Changes

1. **Product and Category Forms**
   - Added "End Sale" toggle to the ProductForm component
   - Added "End Sale" toggle to the CategoryForm component
   - Updated schemas to include the saleEnded property

2. **Service Layer**
   - Added `toggleSaleEnded` functions to handle sale ended status for products and categories
   - Updated create and update functions to include the sale_ended property

3. **User Interface**
   - Updated UI components to display "Sale Ended" badges
   - Enhanced BuyButton to respect all levels of sale ended status
   - Updated ProductModal to check for all levels of sale ended status

## Usage

### Merchant View

1. **Collection-Level Control**
   - Edit a collection
   - Toggle "End Sale" to enable/disable sales for all products in the collection

2. **Category-Level Control**
   - Edit a category
   - Toggle "End Sale" to enable/disable sales for all products in that category

3. **Product-Level Control**
   - Edit a product
   - Toggle "End Sale" to enable/disable sales for just that product
   - This provides the most granular control

### Customer View

When a product's sale is ended (at any level):
- "Sale Ended" status appears on the product
- Buy button is replaced with a disabled "Sale Ended" button
- Product cannot be purchased

## Technical Notes

- Sale ended status has a precedence hierarchy:
  1. Product-level setting takes precedence
  2. If not set at product level, category-level setting applies
  3. If not set at category level, collection-level setting applies
- UI checks `product.saleEnded`, `product.categorySaleEnded`, and `product.collectionSaleEnded` properties
- The database migration ensures backward compatibility

## Future Considerations

1. Consider adding a scheduled sale end date for all levels
2. Consider adding bulk actions to end sales for multiple products
3. Consider adding notification for customers when sales end 