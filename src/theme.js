// This file is auto-generated - do not edit directly
// Bridge between CSS variables and Tailwind config

export const themeColors = {
  // Primary color with variations
  primary: {
    DEFAULT: 'var(--color-primary)',
    hover: 'var(--color-primary-hover)',
    active: 'var(--color-primary-active)',
    focus: 'var(--color-primary-focus)',
    light: 'var(--color-primary-light)',
    dark: 'var(--color-primary-dark)',
    contrast: 'var(--color-primary-contrast)',
  },
  
  // Secondary color with variations
  secondary: {
    DEFAULT: 'var(--color-secondary)',
    hover: 'var(--color-secondary-hover)',
    active: 'var(--color-secondary-active)',
    focus: 'var(--color-secondary-focus)',
    light: 'var(--color-secondary-light)',
    dark: 'var(--color-secondary-dark)',
    contrast: 'var(--color-secondary-contrast)',
  },
  
  // Background color with variations
  background: {
    DEFAULT: 'var(--color-background)',
    50: 'var(--color-background-50)',
    100: 'var(--color-background-100)',
    200: 'var(--color-background-200)',
    300: 'var(--color-background-300)',
    400: 'var(--color-background-400)',
    500: 'var(--color-background-500)',
    600: 'var(--color-background-600)',
    700: 'var(--color-background-700)',
    800: 'var(--color-background-800)',
    900: 'var(--color-background-900)',
    950: 'var(--color-background-950)',
  },
  
  // Text color with variations
  text: {
    DEFAULT: 'var(--color-text-primary)',
    primary: 'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted: 'var(--color-text-muted)',
    disabled: 'var(--color-text-disabled)',
    link: 'var(--color-text-link)',
    'link-hover': 'var(--color-text-link-hover)',
  },
  
  // Card system
  card: {
    DEFAULT: 'var(--color-card-background)',
    hover: 'var(--color-card-background-hover)',
    active: 'var(--color-card-background-active)',
    border: 'var(--color-card-border)',
    shadow: 'var(--color-card-shadow)',
    'shadow-hover': 'var(--color-card-shadow-hover)',
  },
  
  // Input system
  input: {
    DEFAULT: 'var(--color-input-background)',
    hover: 'var(--color-input-background-hover)',
    focus: 'var(--color-input-background-focus)',
    border: 'var(--color-input-border)',
    'border-focus': 'var(--color-input-border-focus)',
    shadow: 'var(--color-input-shadow)',
    'shadow-focus': 'var(--color-input-shadow-focus)',
  },
  
  // Button system
  button: {
    shadow: 'var(--color-button-shadow)',
    'shadow-hover': 'var(--color-button-shadow-hover)',
    highlight: 'var(--color-button-highlight)',
  },
  
  // Border system
  border: {
    DEFAULT: 'var(--color-border-color)',
    light: 'var(--color-border-light)',
    focus: 'var(--color-border-focus)',
  },
  
  // UI element colors
  overlay: {
    hover: 'var(--color-hover-overlay)',
    active: 'var(--color-active-overlay)',
  },
  
  focus: {
    ring: 'var(--color-focus-ring)',
  },
  
  modal: {
    backdrop: 'var(--color-modal-backdrop)',
  },
  
  // Feedback colors
  success: {
    DEFAULT: 'var(--color-success)',
    light: 'var(--color-success-light)',
    dark: 'var(--color-success-dark)',
  },
  
  warning: {
    DEFAULT: 'var(--color-warning)',
    light: 'var(--color-warning-light)',
    dark: 'var(--color-warning-dark)',
  },
  
  error: {
    DEFAULT: 'var(--color-error)',
    light: 'var(--color-error-light)',
    dark: 'var(--color-error-dark)',
  },
  
  info: {
    DEFAULT: 'var(--color-info)',
    light: 'var(--color-info-light)',
    dark: 'var(--color-info-dark)',
  },
  
  // Backward compatibility
  black: '#000000',
  white: '#ffffff',
  gray: {
    50: 'var(--color-background-50)',
    100: 'var(--color-background-100)',
    200: 'var(--color-background-200)',
    300: 'var(--color-background-300)',
    400: 'var(--color-background-400)',
    500: 'var(--color-background-500)',
    600: 'var(--color-background-600)',
    700: 'var(--color-background-700)',
    800: 'var(--color-background-800)',
    900: 'var(--color-background-900)',
    950: 'var(--color-background-950)',
  },
};

// Add elevation box-shadow utilities
export const themeShadows = {
  'elevation-1': 'var(--color-elevation-1)',
  'elevation-2': 'var(--color-elevation-2)',
  'elevation-3': 'var(--color-elevation-3)',
  'elevation-4': 'var(--color-elevation-4)',
  'elevation-5': 'var(--color-elevation-5)',
  'inset-1': 'var(--color-inset-1)',
  'inset-2': 'var(--color-inset-2)',
  'highlight-top': 'var(--color-highlight-top)',
  'highlight-bottom': 'var(--color-highlight-bottom)',
  'focus-ring': 'var(--color-focus-ring)',
};

export default {
  theme: {
    extend: {
      colors: themeColors,
      boxShadow: themeShadows,
    }
  }
}; 