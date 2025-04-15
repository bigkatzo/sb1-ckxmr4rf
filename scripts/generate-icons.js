import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Define all sizes needed for comprehensive icon coverage
const sizes = [
  // Standard PWA icons
  { width: 192, height: 192, name: 'icon-192x192.png' },
  { width: 512, height: 512, name: 'icon-512x512.png' },
  
  // Maskable PWA icons with padding (for Android)
  { width: 192, height: 192, name: 'maskable-192x192.png', maskable: true },
  { width: 512, height: 512, name: 'maskable-512x512.png', maskable: true },
  
  // Favicons
  { width: 16, height: 16, name: 'favicon-16x16.png' },
  { width: 32, height: 32, name: 'favicon-32x32.png' },
  { width: 48, height: 48, name: 'favicon-48x48.png' },
  { width: 96, height: 96, name: 'favicon-96x96.png' },
  
  // Apple Touch Icons (iOS)
  { width: 57, height: 57, name: 'apple-touch-icon-57x57.png' }, // Legacy iOS
  { width: 60, height: 60, name: 'apple-touch-icon-60x60.png' }, // iOS 7
  { width: 72, height: 72, name: 'apple-touch-icon-72x72.png' }, // iPad
  { width: 76, height: 76, name: 'apple-touch-icon-76x76.png' }, // iPad
  { width: 114, height: 114, name: 'apple-touch-icon-114x114.png' }, // Retina iPhone
  { width: 120, height: 120, name: 'apple-touch-icon-120x120.png' }, // Retina iPhone
  { width: 144, height: 144, name: 'apple-touch-icon-144x144.png' }, // Retina iPad
  { width: 152, height: 152, name: 'apple-touch-icon-152x152.png' }, // Retina iPad
  { width: 180, height: 180, name: 'apple-touch-icon.png' }, // Main (standardized name)
  
  // Microsoft Tiles
  { width: 70, height: 70, name: 'ms-icon-70x70.png' },
  { width: 144, height: 144, name: 'ms-icon-144x144.png' },
  { width: 150, height: 150, name: 'ms-icon-150x150.png' },
  { width: 310, height: 310, name: 'ms-icon-310x310.png' },
  
  // Social sharing (defaults, these will be replaced by user uploads)
  { width: 1200, height: 630, name: 'og-default-image.png' },
  { width: 1200, height: 600, name: 'twitter-default-image.png' },
  
  // Special sizes for crypto wallets and in-app browsers
  { width: 196, height: 196, name: 'crypto-196x196.png' },
  { width: 128, height: 128, name: 'notification-icon.png' },
];

const inputSvg = 'public/icons/icon.svg';
const outputDir = 'public/icons';

async function generateIcons() {
  try {
    // Read the SVG file
    const svgBuffer = await fs.readFile(inputSvg);
    
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate each size
    await Promise.all(sizes.map(async ({ width, height, name, maskable }) => {
      const outputPath = path.join(outputDir, name);
      
      let processedImage = sharp(svgBuffer).resize(width, height);
      
      // For maskable icons, add padding of 10% around the image
      if (maskable) {
        // Calculate new dimensions with safe area (80% of the total size)
        const safeWidth = Math.floor(width * 0.8);
        const safeHeight = Math.floor(height * 0.8);
        const padding = Math.floor((width - safeWidth) / 2);
        
        // Resize to the safe area dimensions, then add padding
        processedImage = sharp(svgBuffer)
          .resize(safeWidth, safeHeight)
          .extend({
            top: padding,
            bottom: padding,
            left: padding,
            right: padding,
            background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent padding
          })
          .resize(width, height); // Final resize to ensure exact dimensions
      }
      
      await processedImage.png().toFile(outputPath);
      console.log(`Generated ${outputPath}`);
    }));
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons(); 