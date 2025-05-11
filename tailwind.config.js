/** @type {import('tailwindcss').Config} */
import { themeColors } from './src/theme.js';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Use the themeColors directly which now references CSS variables
      colors: themeColors,
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
          '0%, 100%': { boxShadow: '0 0 15px rgba(var(--color-primary-rgb, 15, 71, 228), 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(var(--color-primary-rgb, 15, 71, 228), 0.6)' }
        },
        'slideDown': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        marquee: 'marquee 15s linear infinite',
        'fade-in': 'fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'glow': 'glow 2.5s ease-in-out infinite',
        'slideDown': 'slideDown 0.2s ease-out forwards'
      }
    },
  },
  plugins: [],
};
