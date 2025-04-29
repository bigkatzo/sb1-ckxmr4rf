const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

/**
 * Generate a custom Tailwind config with theme colors
 * This is used by the site-settings plugin
 */
async function generateTailwindTheme(settings) {
  try {
    const configPath = path.join(process.cwd(), 'src', 'theme.js');
    
    // Get theme colors with defaults
    const primaryColor = settings.theme_primary_color || '#0f47e4';
    const secondaryColor = settings.theme_secondary_color || '#0ea5e9';
    const backgroundColor = settings.theme_background_color || '#000000';
    const textColor = settings.theme_text_color || '#ffffff';
    
    // Generate shades of the primary and secondary colors
    const primaryShades = generateColorShades(primaryColor);
    const secondaryShades = generateColorShades(secondaryColor);
    
    // Create the theme config as an ES module
    const content = `// This file is auto-generated - do not edit directly
// Generated from site settings on ${new Date().toISOString()}

export const themeColors = {
  primary: ${JSON.stringify(primaryShades, null, 2)},
  secondary: ${JSON.stringify(secondaryShades, null, 2)},
  background: "${backgroundColor}",
  text: "${textColor}"
};

export default {
  theme: {
    extend: {
      colors: themeColors
    }
  }
};
`;
    
    // Make sure the directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write the config file
    fs.writeFileSync(configPath, content);
    console.log(`Generated Tailwind theme at ${configPath}`);
    
    return true;
  } catch (error) {
    console.error('Error generating Tailwind theme:', error);
    return false;
  }
}

/**
 * Generate color shades based on a base color
 * @param {string} baseColor - Base color in hex format
 * @returns {object} - Object with color shades from 50 to 950
 */
function generateColorShades(baseColor) {
  const shades = {
    '50': lightenColor(baseColor, 80),
    '100': lightenColor(baseColor, 70),
    '200': lightenColor(baseColor, 60),
    '300': lightenColor(baseColor, 40),
    '400': lightenColor(baseColor, 20),
    '500': baseColor,
    '600': darkenColor(baseColor, 10),
    '700': darkenColor(baseColor, 20),
    '800': darkenColor(baseColor, 30),
    '900': darkenColor(baseColor, 40),
    '950': darkenColor(baseColor, 50),
  };
  
  return shades;
}

/**
 * Lighten a color by a percentage
 * @param {string} color - Hex color code
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} - Lightened hex color
 */
function lightenColor(color, percent) {
  return adjustColor(color, Math.floor(255 * (percent / 100)));
}

/**
 * Darken a color by a percentage
 * @param {string} color - Hex color code
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} - Darkened hex color
 */
function darkenColor(color, percent) {
  return adjustColor(color, -Math.floor(255 * (percent / 100)));
}

/**
 * Adjust a color's brightness
 * @param {string} color - Hex color code
 * @param {number} amount - Amount to adjust brightness
 * @returns {string} - Modified hex color
 */
function adjustColor(color, amount) {
  // Remove # if present
  color = color.replace('#', '');
  
  // Parse the hex values
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);
  
  // Adjust the brightness
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Generate CSS variables for theme colors
 */
async function generateThemeCSS(settings) {
  // Create public/css directory if it doesn't exist
  const cssDir = path.join(process.cwd(), 'public', 'css');
  if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
  }
  
  const cssPath = path.join(cssDir, 'theme-variables.css');
  
  // Get theme colors with defaults
  const primaryColor = settings.theme_primary_color || '#0f47e4';
  const secondaryColor = settings.theme_secondary_color || '#0ea5e9';
  const backgroundColor = settings.theme_background_color || '#000000';
  const textColor = settings.theme_text_color || '#ffffff';
  
  // Create CSS variables
  const css = `:root {
  --color-primary: ${primaryColor};
  --color-primary-hover: ${adjustColor(primaryColor, -15)};
  --color-primary-light: ${adjustColor(primaryColor, 15)};
  --color-primary-dark: ${adjustColor(primaryColor, -30)};
  
  --color-secondary: ${secondaryColor};
  --color-secondary-hover: ${adjustColor(secondaryColor, -15)};
  --color-secondary-light: ${adjustColor(secondaryColor, 15)};
  --color-secondary-dark: ${adjustColor(secondaryColor, -30)};
  
  --color-background: ${backgroundColor};
  --color-text: ${textColor};
}

/* Helper classes */
.bg-primary { background-color: var(--color-primary); }
.bg-primary-hover { background-color: var(--color-primary-hover); }
.bg-primary-light { background-color: var(--color-primary-light); }
.bg-primary-dark { background-color: var(--color-primary-dark); }

.bg-secondary { background-color: var(--color-secondary); }
.bg-secondary-hover { background-color: var(--color-secondary-hover); }
.bg-secondary-light { background-color: var(--color-secondary-light); }
.bg-secondary-dark { background-color: var(--color-secondary-dark); }

.text-primary { color: var(--color-primary); }
.text-secondary { color: var(--color-secondary); }
`;

  // Write the CSS file
  fs.writeFileSync(cssPath, css);
  console.log(`Generated theme CSS variables at ${cssPath}`);
  
  // Update index.html to include this CSS file
  const indexPath = path.join(process.cwd(), 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Check if the CSS link already exists
    if (!html.includes('/css/theme-variables.css')) {
      // Add the CSS link before closing head tag
      html = html.replace(
        /<\/head>/,
        `    <link rel="stylesheet" href="/css/theme-variables.css">\n  </head>`
      );
      
      fs.writeFileSync(indexPath, html);
      console.log('Updated index.html to include theme CSS');
    }
  }
}

module.exports = {
  generateTailwindTheme,
  generateThemeCSS
}; 