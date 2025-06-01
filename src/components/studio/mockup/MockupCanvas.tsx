import { useEffect, useRef, useState } from 'react';
import { PrintMethod } from './templates/templateData';

interface MockupCanvasProps {
  designImage: string;
  templateImage: string;
  displacementMap: string;
  printMethod: PrintMethod;
  position: { x: number; y: number };
  size: number;
  rotation: number;
  opacity: number;
  wrinkleIntensity: number;
  printPressure: number;
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
  rotation = 0,
  opacity = 1,
  wrinkleIntensity = 0.5,
  printPressure = 1,
  onRender,
  className = ''
}: MockupCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isAppMounted, setIsAppMounted] = useState(false);
  
  // Use a simpler approach without relying on PixiJS Application
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Clean up any existing canvas elements
    while (canvasRef.current.firstChild) {
      canvasRef.current.removeChild(canvasRef.current.firstChild);
    }
    
    // Create a plain canvas element
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1200;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasRef.current.appendChild(canvas);
    
    setIsAppMounted(true);
    
    return () => {
      if (canvasRef.current) {
        while (canvasRef.current.firstChild) {
          canvasRef.current.removeChild(canvasRef.current.firstChild);
        }
      }
      setIsAppMounted(false);
    };
  }, []);
  
  // Apply wrinkle displacement mapping
  const applyDisplacementMap = async (
    ctx: CanvasRenderingContext2D,
    designImg: HTMLImageElement,
    displacementImg: HTMLImageElement,
    x: number,
    y: number,
    width: number, 
    height: number,
    intensity: number
  ) => {
    // Create an offscreen canvas for the displacement effect
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offCtx = offscreenCanvas.getContext('2d');
    if (!offCtx) return;
    
    // Draw the design onto the offscreen canvas
    offCtx.drawImage(designImg, 0, 0, width, height);
    
    // Get the displacement map's pixel data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    
    // Draw the displacement map scaled to the design size
    tempCtx.drawImage(displacementImg, 0, 0, width, height);
    
    // Get the image data
    const designData = offCtx.getImageData(0, 0, width, height);
    const displacementData = tempCtx.getImageData(0, 0, width, height);
    
    // Create a new ImageData for the warped result
    const resultData = new ImageData(width, height);
    
    // Apply displacement mapping
    for (let i = 0; i < designData.data.length; i += 4) {
      const pixelIndex = i / 4;
      const pixelX = pixelIndex % width;
      const pixelY = Math.floor(pixelIndex / width);
      
      // Get displacement values from red and green channels
      const displacementX = (displacementData.data[i] - 128) * intensity;
      const displacementY = (displacementData.data[i + 1] - 128) * intensity;
      
      // Calculate new coordinates with displacement
      const sourceX = Math.max(0, Math.min(width - 1, pixelX + displacementX));
      const sourceY = Math.max(0, Math.min(height - 1, pixelY + displacementY));
      
      // Get the pixel from source
      const sourceIndex = (Math.floor(sourceY) * width + Math.floor(sourceX)) * 4;
      
      // Copy the pixel
      resultData.data[i] = designData.data[sourceIndex] || 0;
      resultData.data[i + 1] = designData.data[sourceIndex + 1] || 0;
      resultData.data[i + 2] = designData.data[sourceIndex + 2] || 0;
      resultData.data[i + 3] = designData.data[sourceIndex + 3] || 0;
    }
    
    // Put the displaced image data back
    offCtx.putImageData(resultData, 0, 0);
    
    // Draw the warped image to the main canvas
    ctx.drawImage(offscreenCanvas, x, y, width, height);
  };
  
  // Apply embroidery texture effect with thread direction
  const applyEmbroideryEffect = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    width: number, 
    height: number,
    pressure: number
  ) => {
    // Create a subtle texture pattern for embroidery
    const originalGlobalAlpha = ctx.globalAlpha;
    
    // Add some slight texture to simulate thread
    ctx.globalAlpha = 0.2 * pressure; // Adjust intensity based on pressure
    
    // Draw thread patterns with different directions
    const threadSpacing = 4;
    const threadPatterns = [
      // Horizontal threads
      (x: number, y: number, width: number, i: number) => {
        ctx.moveTo(x, y + i);
        ctx.lineTo(x + width, y + i);
      },
      // Vertical threads
      (x: number, y: number, height: number, i: number) => {
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i, y + height);
      },
      // Diagonal threads (45 degrees)
      (x: number, y: number, size: number, i: number) => {
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + Math.min(i + size, width), y + Math.min(size, height));
      },
      // Diagonal threads (-45 degrees)
      (x: number, y: number, size: number, i: number) => {
        ctx.moveTo(x + i, y + height);
        ctx.lineTo(x + Math.min(i + size, width), y + Math.max(height - size, 0));
      }
    ];
    
    // Save context state
    ctx.save();
    
    // Create a clipping region to constrain the effect to the design area
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    
    // Apply different thread patterns
    for (let patternIndex = 0; patternIndex < threadPatterns.length; patternIndex++) {
      const threadPattern = threadPatterns[patternIndex];
      const patternSpacing = threadSpacing * (patternIndex + 1);
      
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${0.15 * pressure})`; // Adjust opacity based on pressure
      ctx.lineWidth = 0.8 * pressure; // Adjust line width based on pressure
      
      // Draw pattern lines
      for (let i = 0; i < Math.max(width, height); i += patternSpacing) {
        threadPattern(x, y, Math.max(width, height), i);
      }
      
      ctx.stroke();
    }
    
    // Create texture for the raised effect
    ctx.fillStyle = `rgba(0,0,0,${0.05 * pressure})`;
    
    // Add subtle noise pattern for texture
    for (let i = 0; i < width * height * 0.01 * pressure; i++) {
      const dotX = x + Math.random() * width;
      const dotY = y + Math.random() * height;
      const dotSize = Math.random() * 1.5 * pressure;
      
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Restore context state
    ctx.restore();
    
    // Reset global alpha
    ctx.globalAlpha = originalGlobalAlpha;
  };
  
  // Apply screen print texture effect
  const applyScreenPrintEffect = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    width: number, 
    height: number,
    pressure: number
  ) => {
    // Create a subtle dot pattern for screen printing
    const originalGlobalAlpha = ctx.globalAlpha;
    
    // Add some dots to simulate screen print texture
    ctx.globalAlpha = 0.05 * pressure;
    ctx.fillStyle = '#000000';
    
    // Save context state
    ctx.save();
    
    // Create a clipping region to constrain the effect to the design area
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    
    const dotSpacing = 10 / pressure; // Adjust dot spacing based on pressure
    const dotSize = 1 * pressure; // Adjust dot size based on pressure
    
    // Draw dot pattern
    for (let i = 0; i < width; i += dotSpacing) {
      for (let j = 0; j < height; j += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x + i, y + j, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Create ink spread effect based on pressure
    if (pressure > 0.7) {
      ctx.globalAlpha = 0.08 * (pressure - 0.7) / 0.3;
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3 * pressure;
      
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.fill();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    
    // Restore context state
    ctx.restore();
    
    // Reset global alpha
    ctx.globalAlpha = originalGlobalAlpha;
  };
  
  // Apply vinyl effect with slight glossiness
  const applyVinylEffect = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    width: number, 
    height: number,
    pressure: number
  ) => {
    const originalGlobalAlpha = ctx.globalAlpha;
    
    // Save context state
    ctx.save();
    
    // Create a clipping region to constrain the effect to the design area
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    
    // Add glossy highlight
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, `rgba(255,255,255,${0.1 * pressure})`);
    gradient.addColorStop(0.5, `rgba(255,255,255,${0 * pressure})`);
    gradient.addColorStop(1, `rgba(255,255,255,${0.05 * pressure})`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
    
    // Add raised edge effect based on pressure
    if (pressure > 0.5) {
      ctx.strokeStyle = `rgba(0,0,0,${0.15 * pressure})`;
      ctx.lineWidth = 1 * pressure;
      ctx.stroke();
      
      // Add inner shadow for raised effect
      ctx.shadowColor = `rgba(0,0,0,${0.2 * pressure})`;
      ctx.shadowBlur = 2 * pressure;
      ctx.shadowOffsetX = 1 * pressure;
      ctx.shadowOffsetY = 1 * pressure;
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    // Restore context state
    ctx.restore();
    
    // Reset global alpha
    ctx.globalAlpha = originalGlobalAlpha;
  };
  
  // Handle rendering the mockup when props change
  useEffect(() => {
    if (!isAppMounted || !canvasRef.current || !designImage || !templateImage) return;
    
    const canvas = canvasRef.current.querySelector('canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Load and draw the template image
    const loadImages = async () => {
      try {
        console.log('Loading images with params:', { designImage, templateImage, position, size, rotation, opacity });
        
        // Load template image
        const templateImg = new Image();
        templateImg.crossOrigin = 'anonymous';
        
        // Create a promise to wait for image load
        await new Promise<void>((resolve, reject) => {
          templateImg.onload = () => resolve();
          templateImg.onerror = (e) => {
            console.error('Error loading template image:', e);
            reject(e);
          };
          templateImg.src = templateImage;
        });
        
        // Draw template as background (maintaining aspect ratio)
        const templateAspect = templateImg.width / templateImg.height;
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        
        // Adjust dimensions to maintain aspect ratio
        if (templateAspect > 1) {
          drawHeight = canvas.width / templateAspect;
        } else {
          drawWidth = canvas.height * templateAspect;
        }
        
        // Center the image on the canvas
        const offsetX = (canvas.width - drawWidth) / 2;
        const offsetY = (canvas.height - drawHeight) / 2;
        
        // Draw the template image
        ctx.drawImage(templateImg, offsetX, offsetY, drawWidth, drawHeight);
        
        // Load design image
        const designImg = new Image();
        designImg.crossOrigin = 'anonymous';
        
        // Create a promise to wait for image load
        await new Promise<void>((resolve, reject) => {
          designImg.onload = () => {
            console.log('Design image loaded successfully:', designImg.width, 'x', designImg.height);
            resolve();
          };
          designImg.onerror = (e) => {
            console.error('Error loading design image:', e);
            reject(e);
          };
          designImg.src = designImage;
        });
        
        // Calculate design position and size
        const designAspect = designImg.width / designImg.height;
        const baseSize = canvas.width * (size / 100);
        
        // Maintain aspect ratio for the design
        let designWidth = baseSize;
        let designHeight = baseSize / designAspect;
        
        // Save current transform
        ctx.save();
        
        // Move to center of where the design should be
        ctx.translate(
          canvas.width * (position.x / 100), 
          canvas.height * (position.y / 100)
        );
        
        // Apply rotation (convert to radians)
        const rotationRadians = (rotation * Math.PI) / 180;
        ctx.rotate(rotationRadians);
        
        // Set global alpha based on combined opacity and print method
        const methodOpacity = {
          'screen-print': 0.95,
          'dtg': 0.9,
          'embroidery': 0.97,
          'vinyl': 1.0
        }[printMethod] * opacity; // Combine with user-controlled opacity
        
        // Ensure opacity is never completely transparent
        ctx.globalAlpha = Math.max(0.7, methodOpacity);
        console.log('Drawing design with opacity:', ctx.globalAlpha);
        
        // Draw the design centered at the origin
        ctx.drawImage(
          designImg, 
          -designWidth / 2, 
          -designHeight / 2, 
          designWidth, 
          designHeight
        );
        console.log('Design drawn at position:', position.x, position.y);
        
        // Load displacement map if available
        let displacementImg: HTMLImageElement | null = null;
        if (displacementMap && wrinkleIntensity > 0) {
          displacementImg = new Image();
          displacementImg.crossOrigin = 'anonymous';
          
          try {
            await new Promise<void>((resolve, reject) => {
              displacementImg!.onload = () => resolve();
              displacementImg!.onerror = (e) => {
                console.error('Error loading displacement map:', e);
                reject(e);
              };
              displacementImg!.src = displacementMap;
            });
            
            await applyDisplacementMap(
              ctx,
              designImg,
              displacementImg,
              -designWidth / 2,
              -designHeight / 2,
              designWidth,
              designHeight,
              wrinkleIntensity * 0.1 // Scale the intensity to a reasonable range
            );
          } catch (error) {
            console.error('Error applying displacement:', error);
          }
        }
        
        // Apply specific effects based on print method
        switch (printMethod) {
          case 'embroidery':
            applyEmbroideryEffect(
              ctx, 
              -designWidth / 2, 
              -designHeight / 2, 
              designWidth, 
              designHeight,
              printPressure
            );
            break;
          case 'screen-print':
            applyScreenPrintEffect(
              ctx, 
              -designWidth / 2, 
              -designHeight / 2, 
              designWidth, 
              designHeight,
              printPressure
            );
            break;
          case 'vinyl':
            applyVinylEffect(
              ctx, 
              -designWidth / 2, 
              -designHeight / 2, 
              designWidth, 
              designHeight,
              printPressure
            );
            break;
          // DTG doesn't need additional texture effects
        }
        
        // Restore original transform
        ctx.restore();
        
        // Reset global alpha
        ctx.globalAlpha = 1.0;
        
        // Generate output for download if callback provided
        if (onRender) {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            onRender(dataUrl);
          } catch (error) {
            console.error('Error generating image:', error);
          }
        }
      } catch (error) {
        console.error('Error rendering mockup:', error);
      }
    };
    
    loadImages();
  }, [designImage, templateImage, displacementMap, printMethod, position, size, rotation, opacity, wrinkleIntensity, printPressure, onRender, isAppMounted]);
  
  return (
    <div 
      ref={canvasRef} 
      className={`w-full h-full ${className}`}
      aria-label="Mockup preview canvas"
    />
  );
} 