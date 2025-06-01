import * as PIXI from 'pixi.js';

/**
 * Creates a simplified embroidery thread effect for the given sprite
 */
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
  
  // Convert hex color string to number
  const colorNum = parseInt(threadColor.replace('#', '0x'));
  
  // Tint the sprite with the thread color
  sprite.tint = colorNum;
  
  return threadContainer;
} 