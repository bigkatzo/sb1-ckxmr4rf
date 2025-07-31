# Customization Data Implementation

This document describes the implementation of customization data handling in the create-batch-order function.

## Overview

The system now supports per-item customization data in batch orders, including:
- Custom images (uploaded as base64 and stored in S3)
- Custom text input
- Automatic creation of custom_data table entries

## Database Schema

### custom_data Table

```sql
CREATE TABLE custom_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  customizable_image TEXT, -- S3 URL for the uploaded image
  customizable_text TEXT, -- Custom text input
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Storage Bucket

- **Bucket Name**: `customization-images`
- **Access**: Public read, authenticated write
- **File Size Limit**: 5MB
- **Allowed Types**: JPEG, PNG, WebP, GIF

## Data Format

### Input Format (Cart Items)

Each cart item can include customization data:

```javascript
{
  product: { /* product data */ },
  quantity: 1,
  selectedOptions: { /* variant options */ },
  customizationData: {
    image?: File | null,           // Original file object
    text?: string,                 // Custom text
    imagePreview?: string,         // Preview URL (optional)
    imageBase64?: string           // Base64 encoded image data
  }
}
```

### Output Format (Response)

The create-batch-order function now returns additional data:

```javascript
{
  success: true,
  batchOrderId: "...",
  orders: [ /* existing order data */ ],
  customDataResults: [
    {
      orderId: "uuid",
      productId: "uuid", 
      productName: "Product Name",
      customDataId: "uuid",
      hasImage: true,
      hasText: true
    }
  ]
}
```

## Implementation Details

### 1. Image Upload Process

1. **Base64 Processing**: Extracts content type and data from base64 string
2. **Validation**: Checks MIME type and file size
3. **Filename Generation**: Creates safe filename with order/product context
4. **S3 Upload**: Uploads to `customization-images` bucket
5. **URL Generation**: Returns public S3 URL

### 2. Database Entry Creation

1. **Image Upload**: If imageBase64 is present, upload to S3
2. **Text Processing**: Store custom text if present
3. **Entry Creation**: Insert into custom_data table
4. **Error Handling**: Continue processing other items if one fails

### 3. Order Processing Flow

1. **Order Creation**: Create orders as usual
2. **Customization Processing**: After all orders are created, process customization data
3. **Database Entries**: Create custom_data entries for each item with customization
4. **Response**: Include customization results in response

## Functions Added

### 1. uploadCustomizationImage()
- Uploads base64 image to S3
- Generates safe filenames
- Returns public URL

### 2. createCustomDataEntry()
- Creates custom_data table entry
- Handles both image and text data
- Returns entry data or null

### 3. generateCustomizationFilename()
- Creates safe filenames with context
- Format: `customization_{orderId}_{productId}_{timestamp}_{randomId}.{ext}`

## Error Handling

- **Image Upload Failures**: Logged but don't stop order processing
- **Database Errors**: Logged but continue with other items
- **Invalid Data**: Validated before processing
- **Missing Data**: Gracefully handled (no entry created)

## Security

- **RLS Policies**: Row-level security on custom_data table
- **Storage Policies**: Proper access control on S3 bucket
- **File Validation**: MIME type and size validation
- **Filename Sanitization**: Safe filename generation

## Usage Example

```javascript
// Frontend cart item with customization
const cartItem = {
  product: productData,
  quantity: 1,
  customizationData: {
    image: fileObject,
    text: "Custom text here",
    imageBase64: "data:image/jpeg;base64,..."
  }
};

// Send to create-batch-order
const response = await fetch('/.netlify/functions/create-batch-order', {
  method: 'POST',
  body: JSON.stringify({
    items: [cartItem],
    shippingInfo: {...},
    walletAddress: "...",
    paymentMetadata: {...}
  })
});

// Response includes customization results
const result = await response.json();
console.log('Custom data created:', result.customDataResults);
```

## Migration Files

1. `20250115000000_create_custom_data_table.sql` - Creates the custom_data table
2. `20250115000001_add_customization_storage_policies.sql` - Adds S3 storage policies

## Testing

Use the `test-customization.js` file to test the implementation with sample data.

## Notes

- Customization data is processed after order creation to ensure order IDs are available
- Images are stored in a separate bucket for better organization
- The system gracefully handles missing or invalid customization data
- All customization processing is logged for debugging 