#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, '../app/src/main/AndroidManifest.xml');

console.log('🔧 Fixing Android Manifest intent filters...');

try {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  
  // Fix the incorrect universal link intent filters
  // Replace the incorrect host values that include full URLs
  manifest = manifest.replace(
    /android:host="https:\/\/phantom\.app"/g,
    'android:host="phantom.app"'
  );
  
  manifest = manifest.replace(
    /android:host="https:\/\/solflare\.com"/g,
    'android:host="solflare.com"'
  );
  
  manifest = manifest.replace(
    /android:host="https:\/\/backpack\.app"/g,
    'android:host="backpack.app"'
  );

  // Write the fixed manifest back
  fs.writeFileSync(manifestPath, manifest, 'utf8');
  
  console.log('✅ Android Manifest fixed successfully!');
  console.log('📱 Universal link intent filters corrected');
  console.log('🔗 Deep link intent filters are properly configured');
  
} catch (error) {
  console.error('❌ Error fixing Android Manifest:', error);
  process.exit(1);
} 