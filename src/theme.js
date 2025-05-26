// This file is auto-generated - do not edit directly
// Bridge between CSS variables and Tailwind config

export const themeColors = {
  primary: {
    DEFAULT: 'var(--color-primary)',
    hover: 'var(--color-primary-hover)',
    light: 'var(--color-primary-light)',
    dark: 'var(--color-primary-dark)',
  },
  secondary: {
    DEFAULT: 'var(--color-secondary)',
    hover: 'var(--color-secondary-hover)',
    light: 'var(--color-secondary-light)',
    dark: 'var(--color-secondary-dark)',
  },
  background: {
    DEFAULT: 'var(--color-background)',
    900: 'var(--color-background-900)',
    800: 'var(--color-background-800)',
    700: 'var(--color-background-700)',
    600: 'var(--color-background-600)',
  },
  text: {
    DEFAULT: 'var(--color-text)',
    secondary: 'var(--color-text-secondary)',
    muted: 'var(--color-text-muted)',
    disabled: 'var(--color-text-disabled)',
    accent: 'var(--color-text-accent)',
    'accent-muted': 'var(--color-text-accent-muted)',
  },
  // Backward compatibility
  black: '#000000',
  white: 'var(--color-text)',
  gray: {
    50: 'var(--color-text)',
    100: 'var(--color-text)',
    200: 'var(--color-text-secondary)',
    300: 'var(--color-text-secondary)',
    400: 'var(--color-text-muted)',
    500: 'var(--color-text-muted)',
    600: 'var(--color-text-disabled)',
    700: 'var(--color-background-700)',
    800: 'var(--color-background-800)',
    900: 'var(--color-background-900)',
    950: 'var(--color-background)',
  },
};

export default {
  theme: {
    extend: {
      colors: themeColors
    }
  }
}; 