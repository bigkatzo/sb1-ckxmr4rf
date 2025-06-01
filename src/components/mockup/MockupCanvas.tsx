import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { applyEffects } from './effects/printingEffects';
import { PrintMethod } from './templates/templateData';

interface MockupCanvasProps {
  designImage: string;
  templateImage: string;
  displacementMap: string;
  printMethod: PrintMethod;
  position: { x: number; y: number };
  size: number;
  onRender?: (dataUrl: string) => void;
  className?: string;
}

export function MockupCanvas({
  designImage,
  templateImage,
  displacementMap,
  printMethod,
  position,
  size,
  onRender,
  className = ''
}: MockupCanvasProps) {
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
      
      // Apply effects based on print method
      applyEffects(designSprite, printMethod, displacementSprite);
      
      // Add design to container
      container.addChild(designSprite);
      
      // Add everything to stage
      app.stage.addChild(container);
      
      // Generate output for download
      if (onRender) {
        // Wait for a frame to ensure rendering is complete
        requestAnimationFrame(() => {
          try {
            // Use the view directly since it's a canvas element
            const canvas = app.view as HTMLCanvasElement;
            onRender(canvas.toDataURL('image/png'));
          } catch (error) {
            console.error('Error generating image:', error);
          }
        });
      }
    }).catch(error => {
      console.error('Error loading textures:', error);
    });
  }, [designImage, templateImage, displacementMap, printMethod, position, size, onRender]);
  
  return (
    <div 
      ref={canvasRef} 
      className={`w-full h-full ${className}`}
      aria-label="Mockup preview canvas"
    />
  );
} 