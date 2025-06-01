# Mockup Generator Usage Guide

The Mockup Generator allows you to create realistic product mockups by applying your transparent PNG designs to various product templates with professional printing effects.

## Accessing the Mockup Generator

The Mockup Generator is available at `/mockup-generator` in the application.

## Using the Mockup Generator

### 1. Choose a Template

You have two options for templates:

#### A. Upload Your Own Template
- Click the upload area or drag and drop your template image
- Any image format is supported (PNG, JPG, WEBP)
- Maximum file size: 10MB
- Your custom template will not be stored on our servers

#### B. Use a Pre-made Template
Choose from the available product templates:
- T-Shirt (White)
- T-Shirt (Black)
- Hoodie (White)
- Hoodie (Black)

### 2. Upload Your Design

Upload a transparent PNG design:
- Click the upload area or drag and drop your design
- Maximum file size: 5MB
- Only PNG files with transparency are supported

### 3. Position and Size Your Design

After uploading:
- Drag the design to position it on the template
- Use the size slider to adjust the design size

### 4. Choose a Print Method

Select a printing technique to apply realistic effects:

- **Screen Print**: Classic printing method with vibrant colors and a slightly textured feel.
- **Direct to Garment (DTG)**: Provides exceptional detail for complex, photographic designs.
- **Embroidery**: Creates a premium raised texture using stitched threads.
- **Vinyl**: Glossy, raised appearance with sharp edges, perfect for simple shapes and text.

### 5. Download Your Mockup

- Click the "Download Mockup" button to save the generated mockup
- The file will be named with the template and print method information

## Custom Template Workflow

The custom template feature allows you to create mockups with your own product images:

1. **Upload a product image** - This can be any product you want to create a mockup for
2. **Upload your design** - Add your transparent PNG design to overlay on the product
3. **Position and style** - Adjust placement, size, and printing technique 
4. **Download the result** - Get a mockup with your design applied to your custom template

All processing happens in your browser - no images are uploaded to our servers.

## Implementation Details

The Mockup Generator uses PixiJS for WebGL rendering to create professional-quality effects:

- **Displacement mapping**: Creates realistic fabric wrinkles and folds
- **Print-specific effects**: Different visual characteristics based on printing method
- **Interactive positioning**: Drag-and-drop interface for design placement

## Adding New Templates

To add new product templates:

1. Add template images to `/public/mockup-templates/`
2. Add displacement maps to `/public/mockup-templates/displacement-maps/`
3. Update the `PRODUCT_TEMPLATES` array in `src/components/mockup/templates/templateData.ts`

## Customizing Effects

The printing effects can be customized in `src/components/mockup/effects/printingEffects.ts`. 