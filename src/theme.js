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
  },
  
  // Secondary color with variations
  secondary: {
    DEFAULT: 'var(--color-secondary)',
    hover: 'var(--color-secondary-hover)',
    active: 'var(--color-secondary-active)',
    focus: 'var(--color-secondary-focus)',
    light: 'var(--color-secondary-light)',
    dark: 'var(--color-secondary-dark)',
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
  },
  
  // UI element colors
  border: 'var(--color-border-color)',
  input: {
    DEFAULT: 'var(--color-input-background)',
  },
  card: {
    DEFAULT: 'var(--color-card-background)',
  },
  overlay: {
    hover: 'var(--color-hover-overlay)',
    active: 'var(--color-active-overlay)',
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

export default {
  theme: {
    extend: {
      colors: themeColors
    }
  }
}; 