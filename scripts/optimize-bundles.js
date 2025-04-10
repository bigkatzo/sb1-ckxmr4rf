#!/usr/bin/env node

/**
 * Post-build optimization script
 * Performs bundle optimization, minification, and critical CSS extraction
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '../dist');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

/**
 * Main optimization function
 */
async function optimizeBundles() {
  console.log(`${colors.bold}Starting post-build optimizations...${colors.reset}\n`);
  
  try {
    // Verify dist directory exists
    if (!fs.existsSync(distDir)) {
      console.error(`${colors.red}Dist directory not found at ${distDir}${colors.reset}`);
      process.exit(1);
    }
    
    // Find the main HTML, CSS, and JS files
    const indexHtmlPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      console.error(`${colors.red}Index HTML not found at ${indexHtmlPath}${colors.reset}`);
      process.exit(1);
    }
    
    // Read the index.html file
    let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    
    // Find the main CSS file reference
    const cssRegex = /<link rel="stylesheet" href="([^"]+\.css)">/;
    const cssMatch = indexHtml.match(cssRegex);
    
    if (!cssMatch || !cssMatch[1]) {
      console.warn(`${colors.yellow}No CSS file found in index.html${colors.reset}`);
    } else {
      const cssPath = path.join(distDir, cssMatch[1]);
      if (!fs.existsSync(cssPath)) {
        console.error(`${colors.red}CSS file not found at ${cssPath}${colors.reset}`);
      } else {
        console.log(`${colors.blue}Found CSS file: ${cssPath}${colors.reset}`);
        
        // Extract critical CSS (simplified approach)
        // This extracts common styling elements that would be important above the fold
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        
        // Identify critical CSS parts - simplified approach
        // In a real implementation, you would use a tool like critical or penthouse
        const criticalSelectors = [
          // Layout and containers
          'body', 'html', '.container', '.flex', '.grid', '.relative', '.absolute',
          // Navigation
          'header', 'nav', '.navbar', '.nav-', 
          // Hero section
          '.hero', 'h1', 'h2', '.banner', 
          // Text colors and fonts
          '.text-', '.font-', '.bg-gray-', '.bg-black',
          // Common utility classes
          '.w-full', '.h-full', '.p-', '.m-', '.rounded-'
        ];
        
        // Very simple extraction of critical CSS
        // This is a simplified approach - a real implementation would use a proper parser
        let criticalCss = '';
        const cssRules = cssContent.split('}');
        
        for (const rule of cssRules) {
          if (rule.trim().length === 0) continue;
          
          // Check if this rule contains any critical selectors
          const isCritical = criticalSelectors.some(selector => 
            rule.includes(selector)
          );
          
          if (isCritical) {
            criticalCss += rule + '}';
          }
        }
        
        // Remove specific rules from critical CSS to keep it small
        const nonCriticalParts = [
          // Animation classes that aren't needed for initial render
          'animation', '@keyframes',
          // Complex states
          ':hover', ':focus', ':active',
          // Low priority mobile styles
          '@media (max-width: 640px)',
          // Non-critical components
          '.tooltip', '.modal', '.drawer'
        ];
        
        for (const part of nonCriticalParts) {
          criticalCss = criticalCss.replace(new RegExp(`[^{]*${part}[^{]*{[^}]*}`, 'g'), '');
        }
        
        // Minify the critical CSS (very simple minification)
        criticalCss = criticalCss
          .replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, '') // Remove comments and line breaks
          .replace(/ {2,}/g, ' ') // Remove extra spaces
          .replace(/: /g, ':')
          .replace(/ \{/g, '{')
          .replace(/; /g, ';')
          .replace(/  /g, ' ');
        
        // Calculate size savings
        const criticalCssSize = Buffer.byteLength(criticalCss, 'utf8') / 1024;
        const originalCssSize = Buffer.byteLength(cssContent, 'utf8') / 1024;
        console.log(`${colors.green}Extracted critical CSS: ${criticalCssSize.toFixed(1)}KB (${(criticalCssSize / originalCssSize * 100).toFixed(1)}% of total CSS)${colors.reset}`);
        
        // Insert critical CSS inline and load the full CSS asynchronously
        indexHtml = indexHtml.replace(
          cssRegex,
          `<style id="critical-css">${criticalCss}</style>
          <link rel="preload" href="${cssMatch[1]}" as="style" onload="this.onload=null;this.rel='stylesheet'">
          <noscript><link rel="stylesheet" href="${cssMatch[1]}"></noscript>`
        );
        
        // Add preconnect for external resources
        if (!indexHtml.includes('rel="preconnect" href="https://fonts.googleapis.com"')) {
          indexHtml = indexHtml.replace(
            '</head>',
            `  <link rel="preconnect" href="https://fonts.googleapis.com">
              <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
              <link rel="preconnect" href="https://sakysysfksculqobozxi.supabase.co" crossorigin>
            </head>`
          );
        }
      }
    }
    
    // Find JS files and add modulepreload for smaller chunks
    const jsRegex = /<script type="module" crossorigin src="([^"]+\.js)"><\/script>/g;
    const jsMatches = [...indexHtml.matchAll(jsRegex)];
    
    if (jsMatches.length > 0) {
      console.log(`${colors.blue}Found ${jsMatches.length} JS files${colors.reset}`);
      
      // Add modulepreload hints for critical JS files
      let preloadTags = '';
      for (const match of jsMatches) {
        const jsFile = match[1];
        preloadTags += `<link rel="modulepreload" href="${jsFile}">\n`;
      }
      
      // Add modulepreload before the first script tag
      if (preloadTags) {
        indexHtml = indexHtml.replace(
          jsMatches[0][0],
          `${preloadTags}${jsMatches[0][0]}`
        );
      }
    }
    
    // Write the updated index.html file
    fs.writeFileSync(indexHtmlPath, indexHtml);
    console.log(`${colors.green}Updated index.html with optimizations${colors.reset}`);
    
    // Success message
    console.log(`\n${colors.green}${colors.bold}✓ Optimization completed successfully${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Error during optimization:${colors.reset}`, error);
    process.exit(1);
  }
}

// Execute the optimization
optimizeBundles().catch(err => {
  console.error(`${colors.red}Unhandled error:${colors.reset}`, err);
  process.exit(1);
}); 