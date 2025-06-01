import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name correctly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Script to fix PixiJS dependencies for browser compatibility
console.log('📦 Fixing PixiJS dependencies for browser compatibility...');

// Function to create a package.json file for browser compatibility
function createModulePackageJson(targetDir, exportName) {
  const packageJsonPath = path.join(targetDir, 'package.json');
  
  // Check if directory exists
  if (!fs.existsSync(targetDir)) {
    console.log(`Directory ${targetDir} does not exist, skipping.`);
    return;
  }
  
  // Create package.json content
  const packageJson = {
    name: exportName,
    type: "module",
    browser: {
      './dist/cjs/index.js': './dist/esm/index.js'
    },
    main: './dist/esm/index.js',
    module: './dist/esm/index.js',
    exports: {
      import: './dist/esm/index.js',
      require: './dist/cjs/index.js'
    }
  };
  
  // Write package.json file
  try {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`✅ Created ${packageJsonPath}`);
  } catch (error) {
    console.error(`❌ Error writing to ${packageJsonPath}:`, error);
  }
}

// Create redirect index.js files for direct imports
function createRedirectModule(moduleName) {
  const redirectDir = path.join(rootDir, 'src', 'studio', 'pixi-shims', moduleName);
  const redirectPath = path.join(redirectDir, 'index.js');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(redirectDir)) {
    fs.mkdirSync(redirectDir, { recursive: true });
  }
  
  // Create redirect file content
  const redirectContent = `// Shim to redirect imports
export * from 'pixi.js/${moduleName}';
`;
  
  // Write redirect file
  try {
    fs.writeFileSync(redirectPath, redirectContent);
    console.log(`✅ Created redirect for ${moduleName} at ${redirectPath}`);
  } catch (error) {
    console.error(`❌ Error writing redirect for ${moduleName}:`, error);
  }
}

// List of PixiJS modules to create redirects for
const pixiModules = [
  'core',
  'filter-adjustment',
  'filter-bulge-pinch',
  'filter-displacement'
];

// Create redirects for each module
pixiModules.forEach(module => {
  createRedirectModule(module);
});

console.log('✅ PixiJS dependencies fixed successfully!'); 