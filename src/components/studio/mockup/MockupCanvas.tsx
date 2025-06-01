import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
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

/**
 * Simple function to apply opacity based on print method
 */
function applyPrintMethodOpacity(sprite: PIXI.Sprite, method: PrintMethod) {
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
  const pixiApp = useRef<PIXI.Application | null>(null);
  const [isAppReady, setIsAppReady] = useState(false);
  
  // Initialize PixiJS application
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Clean up previous instance if it exists
    if (pixiApp.current) {
      try {
        pixiApp.current.destroy();
      } catch (error) {
        console.error("Error destroying PixiJS application:", error);
      }
      pixiApp.current = null;
      setIsAppReady(false);
    }
    
    try {
      // Create new PIXI application using init() for v8 compatibility
      const app = new PIXI.Application();
      
      // Initialize the application with the appropriate options
      app.init({
        width: 1200,
        height: 1200,
        backgroundColor: 0x000000,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        preserveDrawingBuffer: true, // Needed for image export
      });
      
      // Append the canvas to the DOM - use app.canvas in v8
      if (app.canvas) {
        canvasRef.current.appendChild(app.canvas);
        
        // Store reference and update state
        pixiApp.current = app;
        setIsAppReady(true);
      } else {
        console.error("PixiJS application canvas is not available");
      }
    } catch (error) {
      console.error("Error initializing PixiJS application:", error);
    }
    
    return () => {
      if (pixiApp.current) {
        try {
          pixiApp.current.destroy();
        } catch (error) {
          console.error("Error destroying PixiJS application:", error);
        }
        pixiApp.current = null;
      }
    };
  }, []);
  
  // Update the canvas when props change
  useEffect(() => {
    // Make sure app is ready and we have required images
    if (!isAppReady || !pixiApp.current || !designImage || !templateImage) return;
    
    const app = pixiApp.current;
    
    // Clear previous content
    while (app.stage.children.length > 0) {
      app.stage.removeChildAt(0);
    }
    
    // Create a container for all our content
    const container = new PIXI.Container();
    
    // Load template image and design image sequentially
    const loadTemplateTexture = async () => {
      try {
        // Load the template image
        const templateTexture = await PIXI.Assets.load(templateImage);
        
        // Create template sprite (background)
        const templateSprite = new PIXI.Sprite(templateTexture);
        templateSprite.width = app.screen.width;
        templateSprite.height = app.screen.height;
        container.addChild(templateSprite);
        
        // Add container to stage
        app.stage.addChild(container);
        
        // Now load and add the design image
        const designTexture = await PIXI.Assets.load(designImage);
        
        // Create design sprite
        const designSprite = new PIXI.Sprite(designTexture);
        designSprite.anchor.set(0.5);
        designSprite.x = app.screen.width * (position.x / 100);
        designSprite.y = app.screen.height * (position.y / 100);
        designSprite.width = app.screen.width * (size / 100);
        designSprite.height = app.screen.height * (size / 100);
        
        // Apply basic effects (just opacity for now)
        applyPrintMethodOpacity(designSprite, printMethod);
        
        // Add design to container
        container.addChild(designSprite);
        
        // Generate output for download if callback provided
        if (onRender) {
          // Wait for a frame to ensure rendering is complete
          requestAnimationFrame(() => {
            try {
              if (app && app.canvas) {
                const canvas = app.canvas as HTMLCanvasElement;
                const dataUrl = canvas.toDataURL('image/png');
                onRender(dataUrl);
              } else {
                console.error('PixiJS canvas is not available');
              }
            } catch (error: unknown) {
              console.error('Error generating image:', error);
            }
          });
        }
      } catch (error: unknown) {
        console.error('Error loading textures:', error);
      }
    };
    
    // Start the loading process
    loadTemplateTexture();
    
  }, [designImage, templateImage, displacementMap, printMethod, position, size, onRender, isAppReady]);
  
  return (
    <div 
      ref={canvasRef} 
      className={`w-full h-full ${className}`}
      aria-label="Mockup preview canvas"
    />
  );
} 