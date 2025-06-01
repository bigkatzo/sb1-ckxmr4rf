import { useEffect, useRef, useState } from 'react';
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
        
        // Draw template as background
        ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
        
        // Load design image
        const designImg = new Image();
        designImg.crossOrigin = 'anonymous';
        
        // Create a promise to wait for image load
        await new Promise<void>((resolve, reject) => {
          designImg.onload = () => resolve();
          designImg.onerror = (e) => {
            console.error('Error loading design image:', e);
            reject(e);
          };
          designImg.src = designImage;
        });
        
        // Set global alpha based on print method
        switch (printMethod) {
          case 'screen-print':
            ctx.globalAlpha = 0.95;
            break;
          case 'dtg':
            ctx.globalAlpha = 0.9;
            break;
          case 'embroidery':
            ctx.globalAlpha = 0.97;
            break;
          case 'vinyl':
            ctx.globalAlpha = 1.0;
            break;
        }
        
        // Calculate design position and size
        const designWidth = canvas.width * (size / 100);
        const designHeight = canvas.height * (size / 100);
        const designX = (canvas.width * (position.x / 100)) - (designWidth / 2);
        const designY = (canvas.height * (position.y / 100)) - (designHeight / 2);
        
        // Draw the design
        ctx.drawImage(designImg, designX, designY, designWidth, designHeight);
        
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
  }, [designImage, templateImage, displacementMap, printMethod, position, size, onRender, isAppMounted]);
  
  return (
    <div 
      ref={canvasRef} 
      className={`w-full h-full ${className}`}
      aria-label="Mockup preview canvas"
    />
  );
} 