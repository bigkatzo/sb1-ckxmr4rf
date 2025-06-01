# Mockup Generator Implementation Plan

## Executive Summary

This document outlines the implementation plan for a professional-grade product mockup generator for our e-commerce platform. The generator will allow users to upload transparent PNG designs and apply them to product templates (t-shirts, hoodies, etc.) with realistic printing effects including screen printing, DTG, embroidery, and vinyl.

The solution uses PixiJS for WebGL rendering to achieve professional-quality effects like fabric displacement, texture overlays, and print-specific visual characteristics.

## Technology Stack

### Core Technologies
- **PixiJS**: WebGL-based rendering engine
- **React**: UI components and state management
- **TypeScript**: Type safety and developer experience
- **Vite**: Build system (already in use)

### Required Dependencies
- `pixi.js`: Core rendering library
- `@pixi/filter-displacement`: For fabric wrinkle simulation
- `@pixi/filter-bulge-pinch`: For creating raised effects (embroidery/vinyl)
- `@pixi/filter-adjustment`: For color/contrast adjustments
- `file-saver`: For downloading generated mockups (already in dependencies)
- `html-to-image`: For non-WebGL fallback (already in dependencies)

## Project Structure

```
src/
  components/
    mockup/
      MockupGenerator.tsx       # Main component
      MockupCanvas.tsx          # PixiJS rendering component
      MockupControls.tsx        # UI controls for design manipulation
      MockupTemplateSelector.tsx # Product template selection
      effects/
        printingEffects.ts      # Implementation of various printing effects
        embroideryEffects.ts    # Thread simulation for embroidery
        displacementUtils.ts    # Utilities for fabric displacement
      templates/
        templateData.ts         # Metadata for templates
        templateEffects.ts      # Template-specific effect configurations
  pages/
    MockupGeneratorPage.tsx     # Page component (already created)
  hooks/
    useMockupRenderer.ts        # Custom hook for canvas management
  assets/
    mockup-templates/           # Product template images
    displacement-maps/          # Displacement maps for each template
    effect-textures/            # Textures for different printing methods
```

## Implementation Phases

### Phase 1: Setup & Core Components (1-2 weeks)

1. **Environment Setup**
   - Install required dependencies
   - Create directory structure
   - Set up basic component files

2. **Core Component Implementation**
   - Implement MockupCanvas with PixiJS initialization
   - Create basic displacement mapping
   - Implement template selection
   - Design positioning and scaling

3. **Basic Effect Pipeline**
   - Create the effect application system
   - Implement simple displacement mapping
   - Add basic blend modes for different backgrounds

### Phase 2: Advanced Effects & UX (2-3 weeks)

1. **Print Method Effects**
   - Screen printing effect (slight texture, defined edges)
   - DTG printing effect (more detail, fabric absorption)
   - Embroidery effect (thread texture, raised appearance)
   - Vinyl effect (glossy, raised appearance)

2. **Template-Specific Adjustments**
   - Custom displacement maps for each template
   - Product-specific effect parameters
   - Color/lighting adjustments based on product color

3. **User Experience Improvements**
   - Real-time preview updates
   - Loading states and error handling
   - Mobile-friendly controls
   - Accessibility considerations

### Phase 3: Asset Creation & Collection (1-2 weeks)

1. **Template Images**
   - High-resolution product photos (minimum 2000×2000px)
   - Consistent lighting and perspective
   - Both light and dark variants of each product
   - Multiple angles (front, back, side) where appropriate

2. **Displacement Maps**
   - Create grayscale displacement maps for each template
   - Test and adjust displacement intensity
   - Different maps for different fabric types

3. **Effect Textures**
   - Thread patterns for embroidery
   - Ink texture overlays for screen printing
   - Fabric weave patterns for background integration

### Phase 4: Testing & Optimization (1 week)

1. **Performance Testing**
   - Test with various image sizes
   - Optimize render quality vs. performance
   - Memory management for large mockup sessions

2. **Cross-Browser Testing**
   - Test in major browsers (Chrome, Firefox, Safari, Edge)
   - Mobile browser compatibility
   - WebGL fallback for unsupported browsers

3. **UX Testing**
   - User flow testing
   - Feedback collection
   - Final adjustments

## Technical Implementation Details

### 1. PixiJS Canvas Integration

```typescript
// MockupCanvas.tsx (core implementation)

import * as PIXI from 'pixi.js';
import { useEffect, useRef } from 'react';

export function MockupCanvas({
  designImage,
  templateImage,
  displacementMap,
  printMethod,
  position,
  size,
  onRender
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  
  // Initialize PixiJS application
  useEffect(() => {
    if (!appRef.current && canvasRef.current) {
      appRef.current = new PIXI.Application({
        width: 1200,
        height: 1200,
        backgroundColor: 0x000000,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preserveDrawingBuffer: true, // Needed for image export
      });
      canvasRef.current.appendChild(appRef.current.view as HTMLCanvasElement);
    }
    
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);
  
  // Handle rendering updates
  useEffect(() => {
    if (!appRef.current || !designImage || !templateImage) return;
    
    const app = appRef.current;
    app.stage.removeChildren();
    
    // Create container for proper layering
    const container = new PIXI.Container();
    
    // Load all required textures
    Promise.all([
      PIXI.Texture.from(templateImage),
      PIXI.Texture.from(designImage),
      PIXI.Texture.from(displacementMap)
    ]).then(([templateTexture, designTexture, displacementTexture]) => {
      // Create template sprite (background)
      const templateSprite = new PIXI.Sprite(templateTexture);
      templateSprite.width = app.screen.width;
      templateSprite.height = app.screen.height;
      container.addChild(templateSprite);
      
      // Create design sprite
      const designSprite = new PIXI.Sprite(designTexture);
      designSprite.anchor.set(0.5);
      designSprite.x = app.screen.width * (position.x / 100);
      designSprite.y = app.screen.height * (position.y / 100);
      designSprite.width = app.screen.width * (size / 100);
      designSprite.height = app.screen.height * (size / 100);
      
      // Create displacement sprite
      const displacementSprite = new PIXI.Sprite(displacementTexture);
      displacementSprite.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
      displacementSprite.scale.set(1);
      container.addChild(displacementSprite);
      
      // Apply effects based on print method
      applyEffects(designSprite, printMethod, displacementSprite);
      
      // Add design after effects are applied
      container.addChild(designSprite);
      
      // Add everything to stage
      app.stage.addChild(container);
      
      // Generate output for download
      if (onRender) {
        // Wait for a frame to ensure rendering is complete
        requestAnimationFrame(() => {
          app.renderer.extract.canvas(app.stage).toBlob((blob) => {
            if (blob) onRender(URL.createObjectURL(blob));
          });
        });
      }
    }).catch(error => {
      console.error('Error loading textures:', error);
    });
  }, [designImage, templateImage, displacementMap, printMethod, position, size, onRender]);
  
  return <div ref={canvasRef} className="w-full h-full" />;
}
```

### 2. Effect System Implementation

```typescript
// printingEffects.ts

import * as PIXI from 'pixi.js';
import { DisplacementFilter } from '@pixi/filter-displacement';
import { BulgePinchFilter } from '@pixi/filter-bulge-pinch';
import { AdjustmentFilter } from '@pixi/filter-adjustment';

export type PrintMethod = 'screen-print' | 'dtg' | 'embroidery' | 'vinyl';

export function applyEffects(
  sprite: PIXI.Sprite,
  method: PrintMethod,
  displacementSprite: PIXI.Sprite
) {
  const filters: PIXI.Filter[] = [];
  
  // Base displacement filter for all methods
  const displacementFilter = new DisplacementFilter(displacementSprite);
  
  // Adjust displacement intensity based on method
  switch (method) {
    case 'screen-print':
      displacementFilter.scale.x = 15;
      displacementFilter.scale.y = 15;
      break;
    case 'dtg':
      displacementFilter.scale.x = 20;
      displacementFilter.scale.y = 20;
      break;
    case 'embroidery':
      displacementFilter.scale.x = 10;
      displacementFilter.scale.y = 10;
      break;
    case 'vinyl':
      displacementFilter.scale.x = 5;
      displacementFilter.scale.y = 5;
      break;
  }
  
  filters.push(displacementFilter);
  
  // Method-specific effects
  switch (method) {
    case 'screen-print':
      // Screen printing has slightly reduced opacity and increased contrast
      const screenAdjustment = new AdjustmentFilter({
        contrast: 1.1,
        saturation: 1.05,
        gamma: 1.1
      });
      filters.push(screenAdjustment);
      sprite.alpha = 0.95;
      break;
      
    case 'dtg':
      // DTG has more detail but fades slightly into fabric
      const dtgAdjustment = new AdjustmentFilter({
        contrast: 0.95,
        saturation: 0.98,
        gamma: 0.95
      });
      filters.push(dtgAdjustment);
      sprite.alpha = 0.9;
      break;
      
    case 'embroidery':
      // Embroidery has texture and raised appearance
      const embroideryBulge = new BulgePinchFilter({
        radius: 100,
        strength: 0.05,
        center: [0.5, 0.5]
      });
      
      const embroideryAdjustment = new AdjustmentFilter({
        contrast: 1.2,
        brightness: 1.05,
        saturation: 0.9
      });
      
      filters.push(embroideryBulge, embroideryAdjustment);
      sprite.alpha = 0.97;
      break;
      
    case 'vinyl':
      // Vinyl has a glossy, raised appearance
      const vinylBulge = new BulgePinchFilter({
        radius: 100,
        strength: 0.02,
        center: [0.5, 0.5]
      });
      
      const vinylAdjustment = new AdjustmentFilter({
        brightness: 1.15,
        contrast: 1.25,
        saturation: 1.1,
        gamma: 1.1
      });
      
      filters.push(vinylBulge, vinylAdjustment);
      sprite.alpha = 1.0;
      break;
  }
  
  // Apply all filters
  sprite.filters = filters;
}
```

### 3. Advanced Embroidery Effect (Thread Simulation)

```typescript
// embroideryEffects.ts

import * as PIXI from 'pixi.js';

export function createEmbroideryEffect(
  sprite: PIXI.Sprite,
  threadTexture: PIXI.Texture,
  threadColor: string = '#ffffff'
) {
  // Create thread overlay container
  const threadContainer = new PIXI.Container();
  threadContainer.width = sprite.width;
  threadContainer.height = sprite.height;
  threadContainer.position.set(sprite.x, sprite.y);
  threadContainer.pivot.set(sprite.width / 2, sprite.height / 2);
  
  // Create thread texture overlay
  const threadOverlay = new PIXI.Sprite(threadTexture);
  threadOverlay.width = sprite.width;
  threadOverlay.height = sprite.height;
  threadOverlay.alpha = 0.6;
  threadOverlay.tint = PIXI.utils.string2hex(threadColor);
  
  // Create directional thread effect
  const threadDirection = new PIXI.Graphics();
  threadDirection.beginFill(0xffffff);
  
  // Draw thread direction lines (simplified)
  for (let i = 0; i < sprite.width; i += 4) {
    threadDirection.drawRect(i, 0, 1, sprite.height);
  }
  
  threadDirection.endFill();
  threadDirection.alpha = 0.15;
  
  // Add elements to thread container
  threadContainer.addChild(threadOverlay);
  threadContainer.addChild(threadDirection);
  
  // Create mask from original sprite
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff);
  mask.drawRect(0, 0, sprite.width, sprite.height);
  mask.endFill();
  
  // Apply mask to thread container
  threadContainer.mask = mask;
  
  return threadContainer;
}
```

### 4. Template Configuration

```typescript
// templateData.ts

export interface TemplateConfig {
  id: string;
  name: string;
  path: string;
  displacementMap: string;
  printAreas: {
    front?: PrintArea;
    back?: PrintArea;
    sleeve?: PrintArea;
  };
  defaultPrintMethod: PrintMethod;
}

export interface PrintArea {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  displacementIntensity: number;
}

export type PrintMethod = 'screen-print' | 'dtg' | 'embroidery' | 'vinyl';

export const PRODUCT_TEMPLATES: TemplateConfig[] = [
  {
    id: 'tshirt-white',
    name: 'T-Shirt (White)',
    path: '/mockup-templates/tshirt-white.png',
    displacementMap: '/mockup-templates/displacement-maps/tshirt-displacement.png',
    printAreas: {
      front: {
        x: 50,
        y: 40,
        width: 40,
        height: 50,
        rotation: 0,
        displacementIntensity: 15
      },
      back: {
        x: 50,
        y: 40,
        width: 45,
        height: 55,
        rotation: 0,
        displacementIntensity: 15
      }
    },
    defaultPrintMethod: 'screen-print'
  },
  {
    id: 'tshirt-black',
    name: 'T-Shirt (Black)',
    path: '/mockup-templates/tshirt-black.png',
    displacementMap: '/mockup-templates/displacement-maps/tshirt-displacement.png',
    printAreas: {
      front: {
        x: 50,
        y: 40,
        width: 40,
        height: 50,
        rotation: 0,
        displacementIntensity: 15
      },
      back: {
        x: 50,
        y: 40,
        width: 45,
        height: 55,
        rotation: 0,
        displacementIntensity: 15
      }
    },
    defaultPrintMethod: 'screen-print'
  },
  {
    id: 'hoodie-white',
    name: 'Hoodie (White)',
    path: '/mockup-templates/hoodie-white.png',
    displacementMap: '/mockup-templates/displacement-maps/hoodie-displacement.png',
    printAreas: {
      front: {
        x: 50,
        y: 45,
        width: 35,
        height: 35,
        rotation: 0,
        displacementIntensity: 20
      },
      back: {
        x: 50,
        y: 40,
        width: 45,
        height: 50,
        rotation: 0,
        displacementIntensity: 18
      }
    },
    defaultPrintMethod: 'screen-print'
  },
  {
    id: 'hoodie-black',
    name: 'Hoodie (Black)',
    path: '/mockup-templates/hoodie-black.png',
    displacementMap: '/mockup-templates/displacement-maps/hoodie-displacement.png',
    printAreas: {
      front: {
        x: 50,
        y: 45,
        width: 35,
        height: 35,
        rotation: 0,
        displacementIntensity: 20
      },
      back: {
        x: 50,
        y: 40,
        width: 45,
        height: 50,
        rotation: 0,
        displacementIntensity: 18
      }
    },
    defaultPrintMethod: 'screen-print'
  }
];
```

## UI Design

The mockup generator UI will include:

1. **Template Selection**
   - Grid of product templates
   - Selection for product color variants
   - Front/back view options

2. **Design Upload**
   - Dropzone for transparent PNG uploads
   - Design preview
   - Size and position controls

3. **Print Method Selection**
   - Toggle between different printing techniques
   - Method-specific customization options
   - Preview of effect differences

4. **Mockup Preview**
   - High-quality preview with effects
   - Loading indicator during processing
   - Download button for final mockup

## Resource Requirements

### Assets Needed
1. High-quality product template images
2. Displacement maps for each template
3. Texture overlays for different print methods
4. Thread patterns for embroidery effects

### Team Resources
1. Frontend Developer (React + WebGL experience)
2. Designer for template preparation
3. QA for cross-browser testing

## Risk Assessment

### Technical Risks
1. **WebGL Performance**: Some devices might struggle with complex effects
   - *Mitigation*: Create quality presets and fallback modes

2. **Browser Compatibility**: WebGL support varies across browsers
   - *Mitigation*: Implement feature detection and CSS fallbacks

3. **Memory Usage**: Large images can consume significant memory
   - *Mitigation*: Implement image optimization and cleanup

### Project Risks
1. **Asset Quality**: Template image quality affects final result
   - *Mitigation*: Invest in professional product photography

2. **Scope Creep**: Adding too many printing methods or templates
   - *Mitigation*: Prioritize core templates and methods first

## Implementation Schedule

### Week 1
- Set up project structure
- Implement basic MockupGenerator and MockupCanvas
- Add template selection

### Week 2
- Implement basic displacement mapping
- Add design positioning controls
- Create initial print method effects

### Week 3
- Refine print method effects
- Implement embroidery thread simulation
- Add color and texture adjustments

### Week 4
- Create and integrate template-specific configurations
- Add displacement maps and textures
- Implement download functionality

### Week 5
- Cross-browser testing
- Performance optimization
- UX improvements and bugfixes

## Success Metrics

1. **Performance**
   - Rendering time under 2 seconds on mid-range devices
   - Memory consumption under 200MB

2. **Quality**
   - Visual fidelity compared to actual printed products
   - Realistic fabric interaction with designs

3. **User Experience**
   - Intuitive controls for design placement
   - Clear differentiation between print methods

## Future Enhancements

1. **Advanced Effects**
   - Metallic and specialty printing effects
   - 3D mockups with different angles
   - Fabric texture selection

2. **Integration Features**
   - Direct integration with product listings
   - Batch mockup generation
   - Template creation tool

3. **Performance Improvements**
   - WebAssembly for image processing
   - Worker threads for background rendering
   - Progressive loading for large templates

## Conclusion

This implementation plan provides a comprehensive roadmap for creating a professional-grade mockup generator for our e-commerce platform. The solution uses modern WebGL techniques to achieve realistic printing effects while maintaining good performance across devices.

By following this plan, we can create a mockup generator that not only meets current needs but can be extended with new features and templates in the future. 