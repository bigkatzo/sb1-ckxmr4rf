import * as PIXI from 'pixi.js';
import { DisplacementFilter } from '../../../studio/pixi-shims/filter-displacement';
import { BulgePinchFilter } from '../../../studio/pixi-shims/filter-bulge-pinch';
import { AdjustmentFilter } from '../../../studio/pixi-shims/filter-adjustment';
import { PrintMethod } from '../templates/templateData';

/**
 * Applies print method-specific effects to a sprite
 */
export function applyEffects(
  sprite: PIXI.Sprite,
  method: PrintMethod,
  displacementSprite: PIXI.Sprite
) {
  const filters: any[] = [];
  
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