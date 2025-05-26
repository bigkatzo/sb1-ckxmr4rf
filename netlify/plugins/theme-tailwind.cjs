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
  const useClassicTheme = settings.theme_use_classic !== undefined ? settings.theme_use_classic : true;
  
  // Determine if the background is dark or light (for contrast)
  const isBackgroundDark = isColorDark(backgroundColor);
  
  // Fixed values for classic theme
  const CLASSIC_BG = '#000000';
  const CLASSIC_BG_900 = '#111827';
  const CLASSIC_BG_800 = '#1f2937';
  const CLASSIC_BG_700 = '#374151';
  const CLASSIC_BG_600 = '#4b5563';
  
  // Convert hex to RGB for CSS variables
  const hexToRgb = (hex) => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `${r}, ${g}, ${b}`;
  };
  
  // Helper function to determine if a color is dark
  function isColorDark(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate relative luminance using sRGB color space
    // See: https://www.w3.org/TR/WCAG20/#relativeluminancedef
    const luminance = 0.2126 * r/255 + 0.7152 * g/255 + 0.0722 * b/255;
    
    // Dark colors have luminance < 0.5
    return luminance < 0.5;
  }
  
  // More controlled adjustment function for background shades
  function generateBackgroundShade(baseColor, step) {
    // For dark backgrounds, we lighten
    // For light backgrounds, we darken
    const isDark = isColorDark(baseColor);
    
    if (isDark) {
      // Lighter adjustments for dark backgrounds
      return adjustColor(baseColor, step * 15);
    } else {
      // Darker adjustments for light backgrounds
      return adjustColor(baseColor, -step * 15);
    }
  }
  
  // Generate the background shades based on theme mode
  const bg900 = useClassicTheme ? CLASSIC_BG_900 : generateBackgroundShade(backgroundColor, 1);
  const bg800 = useClassicTheme ? CLASSIC_BG_800 : generateBackgroundShade(backgroundColor, 2);
  const bg700 = useClassicTheme ? CLASSIC_BG_700 : generateBackgroundShade(backgroundColor, 3);
  const bg600 = useClassicTheme ? CLASSIC_BG_600 : generateBackgroundShade(backgroundColor, 4);
  
  // Determine text color adjustments based on background darkness
  const textSecondaryAdjust = isBackgroundDark ? -30 : 30;
  const textMutedAdjust = isBackgroundDark ? -60 : 60;
  const textDisabledAdjust = isBackgroundDark ? -80 : 80;
  
  // Create CSS variables
  const css = `:root {
  --color-primary: ${primaryColor};
  --color-primary-rgb: ${hexToRgb(primaryColor)};
  --color-primary-hover: ${adjustColor(primaryColor, -15)};
  --color-primary-light: ${adjustColor(primaryColor, 15)};
  --color-primary-dark: ${adjustColor(primaryColor, -30)};
  
  --color-secondary: ${secondaryColor};
  --color-secondary-rgb: ${hexToRgb(secondaryColor)};
  --color-secondary-hover: ${adjustColor(secondaryColor, -15)};
  --color-secondary-light: ${adjustColor(secondaryColor, 15)};
  --color-secondary-dark: ${adjustColor(secondaryColor, -30)};
  
  --color-background: ${backgroundColor};
  --color-background-rgb: ${hexToRgb(backgroundColor)};
  --color-background-900: ${bg900};
  --color-background-900-rgb: ${hexToRgb(bg900)};
  --color-background-800: ${bg800};
  --color-background-800-rgb: ${hexToRgb(bg800)};
  --color-background-700: ${bg700};
  --color-background-700-rgb: ${hexToRgb(bg700)};
  --color-background-600: ${bg600};
  --color-background-600-rgb: ${hexToRgb(bg600)};
  
  --color-text: ${textColor};
  --color-text-rgb: ${hexToRgb(textColor)};
  
  /* Text color variants - based on whether we have a dark or light background */
  --color-text-secondary: ${adjustColor(textColor, textSecondaryAdjust)};
  --color-text-secondary-rgb: ${hexToRgb(adjustColor(textColor, textSecondaryAdjust))};
  --color-text-muted: ${adjustColor(textColor, textMutedAdjust)};
  --color-text-muted-rgb: ${hexToRgb(adjustColor(textColor, textMutedAdjust))};
  --color-text-disabled: ${adjustColor(textColor, textDisabledAdjust)};
  --color-text-disabled-rgb: ${hexToRgb(adjustColor(textColor, textDisabledAdjust))};
  --color-text-accent: ${secondaryColor}; 
  --color-text-accent-rgb: ${hexToRgb(secondaryColor)};
  --color-text-accent-muted: ${adjustColor(secondaryColor, isBackgroundDark ? -30 : 30)};
  --color-text-accent-muted-rgb: ${hexToRgb(adjustColor(secondaryColor, isBackgroundDark ? -30 : 30))};
  
  /* Store whether we're using the classic theme */
  --theme-use-classic: ${useClassicTheme ? 'true' : 'false'};
}

/* Helper classes */
html body .bg-primary { background-color: var(--color-primary) !important; }
html body .bg-primary-hover { background-color: var(--color-primary-hover) !important; }
html body .bg-primary-light { background-color: var(--color-primary-light) !important; }
html body .bg-primary-dark { background-color: var(--color-primary-dark) !important; }

html body .bg-secondary { background-color: var(--color-secondary) !important; }
html body .bg-secondary-hover { background-color: var(--color-secondary-hover) !important; }
html body .bg-secondary-light { background-color: var(--color-secondary-light) !important; }
html body .bg-secondary-dark { background-color: var(--color-secondary-dark) !important; }

html body .bg-background { background-color: var(--color-background) !important; }
html body .bg-background-900 { background-color: var(--color-background-900) !important; }
html body .bg-background-800 { background-color: var(--color-background-800) !important; }
html body .bg-background-700 { background-color: var(--color-background-700) !important; }
html body .bg-background-600 { background-color: var(--color-background-600) !important; }

/* Text color classes */
html body .text-primary { color: var(--color-primary) !important; }
html body .text-secondary { color: var(--color-secondary) !important; }
html body .text-default { color: var(--color-text) !important; }
html body .text-secondary-text { color: var(--color-text-secondary) !important; }
html body .text-muted { color: var(--color-text-muted) !important; }
html body .text-disabled { color: var(--color-text-disabled) !important; }
html body .text-accent { color: var(--color-text-accent) !important; }
html body .text-accent-muted { color: var(--color-text-accent-muted) !important; }

/* RGB color usage helpers for opacity */
html body .bg-primary-opacity { background-color: rgba(var(--color-primary-rgb), var(--tw-bg-opacity, 1)) !important; }
html body .bg-secondary-opacity { background-color: rgba(var(--color-secondary-rgb), var(--tw-bg-opacity, 1)) !important; }
html body .bg-background-opacity { background-color: rgba(var(--color-background-rgb), var(--tw-bg-opacity, 1)) !important; }
html body .bg-background-900\/10 { background-color: rgba(var(--color-background-900-rgb), 0.1) !important; }
html body .bg-background-900\/20 { background-color: rgba(var(--color-background-900-rgb), 0.2) !important; }
html body .bg-background-900\/50 { background-color: rgba(var(--color-background-900-rgb), 0.5) !important; }
html body .bg-background-900\/80 { background-color: rgba(var(--color-background-900-rgb), 0.8) !important; }
html body .bg-background-800\/10 { background-color: rgba(var(--color-background-800-rgb), 0.1) !important; }
html body .bg-background-800\/20 { background-color: rgba(var(--color-background-800-rgb), 0.2) !important; }
html body .bg-background-800\/50 { background-color: rgba(var(--color-background-800-rgb), 0.5) !important; }
html body .bg-background-800\/80 { background-color: rgba(var(--color-background-800-rgb), 0.8) !important; }

/* Text with opacity */
html body .text-primary-opacity { color: rgba(var(--color-primary-rgb), var(--tw-text-opacity, 1)) !important; }
html body .text-secondary-opacity { color: rgba(var(--color-secondary-rgb), var(--tw-text-opacity, 1)) !important; }
html body .text-default-opacity { color: rgba(var(--color-text-rgb), var(--tw-text-opacity, 1)) !important; }
html body .text-secondary-text-opacity { color: rgba(var(--color-text-secondary-rgb), var(--tw-text-opacity, 1)) !important; }
html body .text-muted-opacity { color: rgba(var(--color-text-muted-rgb), var(--tw-text-opacity, 1)) !important; }
html body .text-disabled-opacity { color: rgba(var(--color-text-disabled-rgb), var(--tw-text-opacity, 1)) !important; }
html body .text-accent-opacity { color: rgba(var(--color-text-accent-rgb), var(--tw-text-opacity, 1)) !important; }
html body .text-accent-muted-opacity { color: rgba(var(--color-text-accent-muted-rgb), var(--tw-text-opacity, 1)) !important; }

/* 
 * BACKWARD COMPATIBILITY: 
 * Map gray colors to our theme background variables for components still using hard-coded colors
 * Using high specificity selectors to ensure our overrides take effect
 */

/* Background colors */
html body .bg-gray-950 { background-color: var(--color-background) !important; }
html body .bg-gray-900 { background-color: var(--color-background-900) !important; }
html body .bg-gray-800 { background-color: var(--color-background-800) !important; }
html body .bg-gray-700 { background-color: var(--color-background-700) !important; }

/* Background with opacity */
html body .bg-gray-900\/10 { background-color: rgba(var(--color-background-900-rgb), 0.1) !important; }
html body .bg-gray-900\/20 { background-color: rgba(var(--color-background-900-rgb), 0.2) !important; }
html body .bg-gray-900\/50 { background-color: rgba(var(--color-background-900-rgb), 0.5) !important; }
html body .bg-gray-900\/80 { background-color: rgba(var(--color-background-900-rgb), 0.8) !important; }
html body .bg-gray-900\/90 { background-color: rgba(var(--color-background-900-rgb), 0.9) !important; }

html body .bg-gray-800\/10 { background-color: rgba(var(--color-background-800-rgb), 0.1) !important; }
html body .bg-gray-800\/20 { background-color: rgba(var(--color-background-800-rgb), 0.2) !important; }
html body .bg-gray-800\/50 { background-color: rgba(var(--color-background-800-rgb), 0.5) !important; }
html body .bg-gray-800\/80 { background-color: rgba(var(--color-background-800-rgb), 0.8) !important; }

/* Text colors - map all gray text to appropriate text variables */
html body .text-white { color: var(--color-text) !important; }
html body .text-gray-50 { color: var(--color-text) !important; }
html body .text-gray-100 { color: var(--color-text) !important; }
html body .text-gray-200 { color: var(--color-text-secondary) !important; }
html body .text-gray-300 { color: var(--color-text-secondary) !important; }
html body .text-gray-400 { color: var(--color-text-muted) !important; }
html body .text-gray-500 { color: var(--color-text-muted) !important; }
html body .text-gray-600 { color: var(--color-text-disabled) !important; }

/* Hover states for text */
html body .hover\:text-white:hover { color: var(--color-text) !important; }
html body .hover\:text-gray-200:hover { color: var(--color-text-secondary) !important; }
html body .hover\:text-gray-300:hover { color: var(--color-text-secondary) !important; }
html body .hover\:text-gray-400:hover { color: var(--color-text-muted) !important; }

/* Border colors */
html body .border-gray-800 { border-color: var(--color-background-800) !important; }
html body .border-gray-700 { border-color: var(--color-background-700) !important; }
html body .hover\:border-gray-700:hover { border-color: var(--color-background-700) !important; }
html body .hover\:border-gray-600:hover { border-color: var(--color-background-600) !important; }

/* Focus and active states */
html body .focus\:text-white:focus { color: var(--color-text) !important; }
html body .active\:text-white:active { color: var(--color-text) !important; }
html body .focus\:text-gray-200:focus { color: var(--color-text-secondary) !important; }
html body .active\:text-gray-200:active { color: var(--color-text-secondary) !important; }
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
      // Add the CSS link at the very end of the head tag to ensure it loads after all other styles
      html = html.replace(
        /<\/head>/,
        `    <link rel="stylesheet" href="/css/theme-variables.css?v=${Date.now()}" data-priority="high">\n  </head>`
      );
      
      fs.writeFileSync(indexPath, html);
      console.log('Updated index.html to include theme CSS');
    }
  }
}

// Export for CommonJS (Node.js) environments
module.exports = {
  generateTailwindTheme,
  generateThemeCSS
}; 