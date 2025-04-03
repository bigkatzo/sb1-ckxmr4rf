import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const sizes = [192, 512];
const inputSvg = 'public/icons/icon.svg';
const outputDir = 'public/icons';

async function generateIcons() {
  try {
    // Read the SVG file
    const svgBuffer = await fs.readFile(inputSvg);
    
    // Generate each size
    await Promise.all(sizes.map(async size => {
      const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size)
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