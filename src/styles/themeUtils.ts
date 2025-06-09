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
 * Creates a color with a specific alpha transparency
 */
export function withAlpha(color: string, alpha: number): string {
  return `rgba(${hexToRgb(color)}, ${alpha})`;
}

/**
 * Enhances contrast between a foreground and background color
 * @param foreground - Foreground color in hex
 * @param background - Background color in hex
 * @param minContrast - Minimum contrast ratio to achieve
 */
export function ensureContrast(foreground: string, background: string, minContrast = 4.5): string {
  // Calculate the contrast ratio between the colors
  const getContrastRatio = (fg: string, bg: string): number => {
    // Calculate relative luminance
    const getLuminance = (color: string): number => {
      const rgb = hexToRgb(color).split(', ').map(v => parseInt(v) / 255);
      const [r, g, b] = rgb.map(v => 
        v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    
    const lum1 = getLuminance(fg);
    const lum2 = getLuminance(bg);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  };
  
  // Initial contrast ratio
  let contrast = getContrastRatio(foreground, background);
  let adjustedFg = foreground;
  
  // If we need more contrast
  if (contrast < minContrast) {
    // Determine if we should lighten or darken
    const bgIsDark = isColorDark(background);
    let step = bgIsDark ? 10 : -10; // Lighten for dark bg, darken for light bg
    let attempts = 0;
    
    // Adjust until we hit the target contrast (with a limit to prevent infinite loops)
    while (contrast < minContrast && attempts < 20) {
      adjustedFg = adjustColorBrightness(adjustedFg, step);
      contrast = getContrastRatio(adjustedFg, background);
      attempts++;
    }
  }
  
  return adjustedFg;
}

/**
 * Generates elevation shadows based on background color
 * @param isDark - Whether the background is dark
 */
export function generateElevationShadows(isDark: boolean): Record<string, string> {
  // Determine shadow color and opacity based on light/dark mode
  const shadowColor = isDark ? '#000000' : '#000000';
  const shadowOpacity = isDark ? 0.5 : 0.15;
  const highlightColor = isDark ? '#ffffff' : '#ffffff';
  const highlightOpacity = isDark ? 0.05 : 0.07;
  
  return {
    'elevation-1': `0 1px 2px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.5}), 
                    0 1px 3px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.4})`,
    
    'elevation-2': `0 2px 4px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.5}), 
                    0 1px 5px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.6})`,
    
    'elevation-3': `0 4px 8px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.5}), 
                    0 2px 6px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.6}), 
                    0 0 1px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.7})`,
    
    'elevation-4': `0 6px 10px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.6}), 
                    0 3px 8px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.7}), 
                    0 0 2px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.8})`,
    
    'elevation-5': `0 12px 20px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.7}), 
                    0 6px 15px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.8}), 
                    0 0 3px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.9})`,
    
    'inset-1': `inset 0 1px 2px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.5})`,
    
    'inset-2': `inset 0 2px 4px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.5}), 
                inset 0 1px 3px rgba(${hexToRgb(shadowColor)}, ${shadowOpacity * 0.6})`,
    
    'highlight-top': `inset 0 1px 0 rgba(${hexToRgb(highlightColor)}, ${highlightOpacity})`,
    
    'highlight-bottom': `inset 0 -1px 0 rgba(${hexToRgb(highlightColor)}, ${highlightOpacity * 0.5})`,
  };
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
  
  // Calculate elevation levels for cards and UI elements
  const baseElevationAmount = isDarkBackground ? 12 : -12;
  const cardBaseAmount = baseElevationAmount;
  const cardHoverAmount = baseElevationAmount * 1.5;
  const buttonBaseAmount = baseElevationAmount * 0.7;
  
  // Generate shadows
  const shadows = generateElevationShadows(isDarkBackground);
  
  // Generate variations
  return {
    // Primary variations
    'primary-hover': adjustColorBrightness(primaryColor, isDarkBackground ? 30 : -30),
    'primary-active': adjustColorBrightness(primaryColor, isDarkBackground ? -20 : 20),
    'primary-focus': primaryColor,
    'primary-light': adjustColorBrightness(primaryColor, 80),
    'primary-dark': adjustColorBrightness(primaryColor, -80),
    'primary-contrast': ensureContrast('#ffffff', primaryColor),
    
    // Secondary variations
    'secondary-hover': adjustColorBrightness(secondaryColor, isDarkBackground ? 30 : -30),
    'secondary-active': adjustColorBrightness(secondaryColor, isDarkBackground ? -20 : 20),
    'secondary-focus': secondaryColor,
    'secondary-light': adjustColorBrightness(secondaryColor, 80),
    'secondary-dark': adjustColorBrightness(secondaryColor, -80),
    'secondary-contrast': ensureContrast('#ffffff', secondaryColor),
    
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
    'text-link': primaryColor,
    'text-link-hover': adjustColorBrightness(primaryColor, isDarkBackground ? 30 : -30),
    
    // UI variations - borders
    'border-color': adjustColorBrightness(backgroundColor, isDarkBackground ? 40 : -40),
    'border-light': adjustColorBrightness(backgroundColor, isDarkBackground ? 30 : -30),
    'border-focus': primaryColor,
    
    // UI variations - cards and inputs
    'card-background': adjustColorBrightness(backgroundColor, cardBaseAmount),
    'card-background-hover': adjustColorBrightness(backgroundColor, cardHoverAmount),
    'card-background-active': adjustColorBrightness(backgroundColor, cardBaseAmount * 1.8),
    'card-border': adjustColorBrightness(backgroundColor, isDarkBackground ? 30 : -30),
    'card-shadow': shadows['elevation-2'],
    'card-shadow-hover': shadows['elevation-3'],
    'card-hover': isDarkBackground 
      ? adjustColorBrightness(backgroundColor, cardBaseAmount + 15)
      : adjustColorBrightness(backgroundColor, cardBaseAmount - 15),
    
    // Inputs
    'input-background': adjustColorBrightness(backgroundColor, buttonBaseAmount),
    'input-background-hover': adjustColorBrightness(backgroundColor, buttonBaseAmount * 1.5),
    'input-background-focus': adjustColorBrightness(backgroundColor, buttonBaseAmount * 2),
    'input-border': adjustColorBrightness(backgroundColor, isDarkBackground ? 50 : -50),
    'input-border-focus': primaryColor,
    'input-shadow': shadows['inset-1'],
    'input-shadow-focus': `0 0 0 2px ${withAlpha(primaryColor, 0.3)}`,
    
    // Buttons
    'button-shadow': shadows['elevation-1'],
    'button-shadow-hover': shadows['elevation-2'],
    'button-highlight': shadows['highlight-top'],
    
    // Overlays
    'hover-overlay': `rgba(${hexToRgb(textColor)}, 0.05)`,
    'active-overlay': `rgba(${hexToRgb(textColor)}, 0.1)`,
    'focus-ring': `0 0 0 2px ${withAlpha(primaryColor, 0.5)}`,
    'modal-backdrop': `rgba(${hexToRgb(backgroundColor)}, 0.8)`,
    
    // Feedback colors
    'success': '#10b981', // emerald-500
    'success-light': '#34d399', // emerald-400
    'success-dark': '#059669', // emerald-600
    'warning': '#f59e0b', // amber-500
    'warning-light': '#fbbf24', // amber-400
    'warning-dark': '#d97706', // amber-600
    'error': '#ef4444', // red-500
    'error-light': '#f87171', // red-400
    'error-dark': '#dc2626', // red-600
    'info': '#3b82f6', // blue-500
    'info-light': '#60a5fa', // blue-400
    'info-dark': '#2563eb', // blue-600
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
  useClassic: boolean,
  logoUrl?: string
): void {
  // First remove any inline styles to reset to defaults
  if (useClassic) {
    document.documentElement.removeAttribute('style');
    document.documentElement.classList.add('classic-theme');
    document.documentElement.classList.remove('dynamic-theme');
    
    // Add classic hover and focus styles to maintain original behavior
    const style = document.createElement('style');
    style.id = 'classic-theme-hover-focus-styles';
    style.textContent = `
      .classic-theme .hover-effect:hover,
      .classic-theme .card:hover,
      .classic-theme .product-card:hover,
      .classic-theme .collection-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        background-color: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
        transition: all 0.3s ease;
      }
      
      .classic-theme .hover-effect:hover {
        border-color: var(--color-secondary, #8b5cf6);
        box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3);
      }
      
      .classic-theme a:focus-visible,
      .classic-theme button:focus-visible,
      .classic-theme input:focus-visible,
      .classic-theme select:focus-visible,
      .classic-theme textarea:focus-visible,
      .classic-theme [tabindex]:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.5);
      }
    `;
    
    // Remove old style if it exists
    const oldStyle = document.getElementById('classic-theme-hover-focus-styles');
    if (oldStyle) {
      oldStyle.remove();
    }
    
    document.head.appendChild(style);
  } else {
    // If using dynamic theme, remove classic styles
    const classicStyle = document.getElementById('classic-theme-hover-focus-styles');
    if (classicStyle) {
      classicStyle.remove();
    }
    
    document.documentElement.classList.remove('classic-theme');
    document.documentElement.classList.add('dynamic-theme');
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
  
  // Set logo URL if provided
  document.documentElement.style.setProperty('--collection-logo-url', logoUrl ? `url(${logoUrl})` : 'none');
  
  // Generate and set all color variations
  const colorVariations = generateColorVariations(primaryColor, secondaryColor, backgroundColor, textColor);
  Object.entries(colorVariations).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--color-${key}`, value);
  });
  
  // Generate and set all shadow variations
  const shadows = generateElevationShadows(isColorDark(backgroundColor));
  Object.entries(shadows).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--color-${key}`, value);
  });
  
  // Add dynamic theme-specific CSS for hover and focus effects
  const dynamicStyle = document.createElement('style');
  dynamicStyle.id = 'dynamic-theme-hover-focus-styles';
  
  // Create secondary color with alpha for the ring effect
  const secondaryRgb = hexToRgb(secondaryColor);
  
  // Add dynamic hover and focus styles
  dynamicStyle.textContent = `
    .dynamic-theme .hover-effect:hover,
    .dynamic-theme .card:hover,
    .dynamic-theme .product-card:hover,
    .dynamic-theme .collection-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--color-elevation-2);
      background-color: var(--color-card-background-hover);
      border-color: var(--color-border-light);
      transition: all 0.3s ease;
    }
    
    .dynamic-theme .hover-effect:hover {
      border-color: var(--color-secondary);
      box-shadow: 0 0 0 2px rgba(${secondaryRgb}, 0.3);
    }
    
    .dynamic-theme a:focus-visible,
    .dynamic-theme button:focus-visible,
    .dynamic-theme input:focus-visible,
    .dynamic-theme select:focus-visible,
    .dynamic-theme textarea:focus-visible,
    .dynamic-theme [tabindex]:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px rgba(${secondaryRgb}, 0.5);
    }
  `;
  
  // Remove old style if it exists
  const oldDynamicStyle = document.getElementById('dynamic-theme-hover-focus-styles');
  if (oldDynamicStyle) {
    oldDynamicStyle.remove();
  }
  
  document.head.appendChild(dynamicStyle);
} 