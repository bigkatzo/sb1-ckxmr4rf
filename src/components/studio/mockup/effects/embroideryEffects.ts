import * as PIXI from 'pixi.js';

/**
 * Creates a simplified embroidery effect for the given sprite by just adjusting tint
 */
export function createEmbroideryEffect(
  sprite: PIXI.Sprite,
  threadColor: string = '#ffffff'
) {
  // Convert hex color string to number
  const colorNum = parseInt(threadColor.replace('#', '0x'));
  
  // Tint the sprite with the thread color
  sprite.tint = colorNum;
  
  return sprite;
} 