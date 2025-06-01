import * as PIXI from 'pixi.js';
import { PrintMethod } from '../templates/templateData';

/**
 * Applies a simplified version of print method-specific effects to a sprite
 */
export function applyEffects(
  sprite: PIXI.Sprite,
  method: PrintMethod
) {
  // Adjust opacity based on method
  switch (method) {
    case 'screen-print':
      sprite.alpha = 0.95;
      break;
    case 'dtg':
      sprite.alpha = 0.9;
      break;
    case 'embroidery':
      sprite.alpha = 0.97;
      break;
    case 'vinyl':
      sprite.alpha = 1.0;
      break;
  }
} 