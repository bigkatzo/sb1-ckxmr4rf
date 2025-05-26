/**
 * Theme Utilities
 * 
 * This file contains utilities for working with dynamic themes,
 * including generating color variations and applying them to the DOM.
 */

/**
 * Converts a hex color to RGB values
 */
export function hexToRgb(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  return `${r}, ${g}, ${b}`;
}

/**
 * Checks if a color is dark
 */
export function isColorDark(color: string): boolean {
  // Remove # if present
  const cleanHex = color.replace('#', '');
  
  // Parse the hex values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  // Calculate brightness using the formula: (0.299*R + 0.587*G + 0.114*B)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return true if the color is dark (brightness < 128)
  return brightness < 128;
}

/**
 * Adjusts a color's brightness
 * @param color - Hex color
 * @param amount - Amount to adjust (-255 to 255)
 */
export function adjustColorBrightness(color: string, amount: number): string {
  // Remove # if present
  const cleanHex = color.replace('#', '');
  
  // Parse the hex values
  let r = parseInt(cleanHex.substring(0, 2), 16);
  let g = parseInt(cleanHex.substring(2, 4), 16);
  let b = parseInt(cleanHex.substring(4, 6), 16);
  
  // Adjust the brightness
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Generates all the color variations needed for a complete theme
 */
export function generateColorVariations(
  primaryColor: string,
  secondaryColor: string,
  backgroundColor: string,
  textColor: string
): Record<string, string> {
  const isDarkBackground = isColorDark(backgroundColor);
  const isDarkText = isColorDark(textColor);
  
  // Ensure text and background have proper contrast
  if (isDarkBackground === isDarkText) {
    // If both are dark or both are light, adjust text to ensure contrast
    textColor = isDarkBackground ? '#ffffff' : '#000000';
  }
  
  // Generate variations
  return {
    // Primary variations
    'primary-hover': adjustColorBrightness(primaryColor, isDarkBackground ? 30 : -30),
    'primary-active': adjustColorBrightness(primaryColor, isDarkBackground ? -20 : 20),
    'primary-focus': primaryColor,
    'primary-light': adjustColorBrightness(primaryColor, 80),
    'primary-dark': adjustColorBrightness(primaryColor, -80),
    
    // Secondary variations
    'secondary-hover': adjustColorBrightness(secondaryColor, isDarkBackground ? 30 : -30),
    'secondary-active': adjustColorBrightness(secondaryColor, isDarkBackground ? -20 : 20),
    'secondary-focus': secondaryColor,
    'secondary-light': adjustColorBrightness(secondaryColor, 80),
    'secondary-dark': adjustColorBrightness(secondaryColor, -80),
    
    // Background variations
    'background-50': adjustColorBrightness(backgroundColor, isDarkBackground ? 230 : -230),
    'background-100': adjustColorBrightness(backgroundColor, isDarkBackground ? 210 : -210),
    'background-200': adjustColorBrightness(backgroundColor, isDarkBackground ? 180 : -180),
    'background-300': adjustColorBrightness(backgroundColor, isDarkBackground ? 150 : -150),
    'background-400': adjustColorBrightness(backgroundColor, isDarkBackground ? 120 : -120),
    'background-500': adjustColorBrightness(backgroundColor, isDarkBackground ? 90 : -90),
    'background-600': adjustColorBrightness(backgroundColor, isDarkBackground ? 60 : -60),
    'background-700': adjustColorBrightness(backgroundColor, isDarkBackground ? 40 : -40),
    'background-800': adjustColorBrightness(backgroundColor, isDarkBackground ? 20 : -20),
    'background-900': backgroundColor,
    'background-950': adjustColorBrightness(backgroundColor, isDarkBackground ? -10 : 10),
    
    // Text variations
    'text-primary': textColor,
    'text-secondary': adjustColorBrightness(textColor, isDarkBackground ? -40 : 40),
    'text-muted': adjustColorBrightness(textColor, isDarkBackground ? -90 : 90),
    'text-disabled': adjustColorBrightness(textColor, isDarkBackground ? -140 : 140),
    
    // UI variations
    'border-color': adjustColorBrightness(backgroundColor, isDarkBackground ? 40 : -40),
    'input-background': adjustColorBrightness(backgroundColor, isDarkBackground ? 15 : -15),
    'card-background': adjustColorBrightness(backgroundColor, isDarkBackground ? 10 : -10),
    'hover-overlay': `rgba(${hexToRgb(textColor)}, 0.05)`,
    'active-overlay': `rgba(${hexToRgb(textColor)}, 0.1)`,
  };
}

/**
 * Applies a complete theme to the document
 */
export function applyTheme(
  primaryColor: string,
  secondaryColor: string,
  backgroundColor: string,
  textColor: string,
  useClassic: boolean
): void {
  // First remove any inline styles to reset to defaults
  if (useClassic) {
    document.documentElement.removeAttribute('style');
    document.documentElement.classList.add('classic-theme');
    document.documentElement.classList.remove('dynamic-theme');
    return;
  }
  
  // Set base colors
  document.documentElement.style.setProperty('--color-primary', primaryColor);
  document.documentElement.style.setProperty('--color-secondary', secondaryColor);
  document.documentElement.style.setProperty('--color-background', backgroundColor);
  document.documentElement.style.setProperty('--color-text', textColor);
  
  // Set RGB values for the base colors
  document.documentElement.style.setProperty('--color-primary-rgb', hexToRgb(primaryColor));
  document.documentElement.style.setProperty('--color-secondary-rgb', hexToRgb(secondaryColor));
  document.documentElement.style.setProperty('--color-background-rgb', hexToRgb(backgroundColor));
  document.documentElement.style.setProperty('--color-text-rgb', hexToRgb(textColor));
  
  // Generate and set all color variations
  const colorVariations = generateColorVariations(primaryColor, secondaryColor, backgroundColor, textColor);
  Object.entries(colorVariations).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--color-${key}`, value);
  });

  document.documentElement.classList.add('dynamic-theme');
  document.documentElement.classList.remove('classic-theme');
} 