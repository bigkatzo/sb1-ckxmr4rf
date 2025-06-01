import * as PIXI from 'pixi.js';

/**
 * Creates an embroidery thread effect for the given sprite
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
  threadContainer.pivot.set(sprite.width / 2, sprite.height / 2);
  
  // Create thread texture overlay
  const threadOverlay = new PIXI.Sprite(threadTexture);
  threadOverlay.width = sprite.width;
  threadOverlay.height = sprite.height;
  threadOverlay.alpha = 0.6;
  // Convert hex color string to number
  threadOverlay.tint = parseInt(threadColor.replace('#', '0x'));
  
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