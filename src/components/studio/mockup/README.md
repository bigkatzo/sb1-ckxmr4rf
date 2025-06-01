# Mockup Generator

This is a client-side mockup generator for creating product mockups with custom designs. It uses PixiJS for rendering and applying effects like displacement mapping for realistic fabric wrinkles and different printing techniques.

## Features

- Upload transparent PNG designs
- Choose from pre-made product templates or upload your own
- Position and size designs on products
- Apply different printing effects (screen printing, DTG, embroidery, vinyl)
- Download the final mockup as a PNG

## Technical Implementation

The mockup generator uses the following libraries:
- PixiJS for canvas rendering and effects
- React Dropzone for file uploads
- File-Saver for downloading the generated mockups

## Asset Requirements

For the mockup generator to work properly, you need the following assets in the public directory:

```
public/
  mockup-templates/
    tshirt-white.png
    tshirt-black.png
    hoodie-white.png
    hoodie-black.png
    displacement-maps/
      default-displacement.png
      tshirt-displacement.png
      hoodie-displacement.png
```

## Component Structure

- MockupGenerator: Main component that orchestrates the entire mockup generation process
- MockupCanvas: Handles the PixiJS rendering of the design on the template
- MockupControls: UI for adjusting design parameters and downloading the mockup
- MockupTemplateSelector: UI for selecting product templates
- CustomTemplateUploader: Component for uploading custom templates

## Lazy Loading

This feature is lazy-loaded to only be available on the /studio route, which prevents unnecessary loading of PixiJS and other dependencies for users who aren't using this feature. 