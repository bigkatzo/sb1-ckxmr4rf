/** @type {import('tailwindcss').Config} */
import defaultTheme from './src/theme.js';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Default theme values (will be overridden if dynamic theme exists)
      colors: {
        primary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        secondary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
      // Merge with dynamic theme from admin dashboard
      ...defaultTheme?.theme?.extend || {},
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(15px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 }
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 15px rgba(15, 71, 228, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(15, 71, 228, 0.6)' }
        }
      },
      animation: {
        marquee: 'marquee 15s linear infinite',
        'fade-in': 'fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'glow': 'glow 2.5s ease-in-out infinite'
      }
    },
  },
  plugins: [],
};
