import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

// Define all sizes needed for the application
const sizes = [
  // PWA icons
  { width: 192, height: 192, name: 'icon-192x192.png' },
  { width: 512, height: 512, name: 'icon-512x512.png' },
  // Favicons
  { width: 16, height: 16, name: 'favicon-16x16.png' },
  { width: 32, height: 32, name: 'favicon-32x32.png' },
  // Apple Touch Icon
  { width: 180, height: 180, name: 'apple-touch-icon.png' },
  // Microsoft Tiles
  { width: 70, height: 70, name: 'ms-icon-70x70.png' },
  { width: 150, height: 150, name: 'ms-icon-150x150.png' },
  { width: 310, height: 310, name: 'ms-icon-310x310.png' },
];

const inputSvg = 'public/icons/icon.svg';
const outputDir = 'public/icons';

async function generateIcons() {
  try {
    // Read the SVG file
    const svgBuffer = await fs.readFile(inputSvg);
    
    // Generate each size
    await Promise.all(sizes.map(async ({ width, height, name }) => {
      const outputPath = path.join(outputDir, name);
      
      await sharp(svgBuffer)
        .resize(width, height)
        .png()
        .toFile(outputPath);
        
      console.log(`Generated ${outputPath}`);
    }));
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons(); 