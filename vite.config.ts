import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true
      }
    })
  ],
  build: {
    sourcemap: true,
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React dependencies
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router-dom/')) {
            return 'vendor-react';
          }
          
          // Solana dependencies
          if (id.includes('node_modules/@solana/')) {
            return 'vendor-solana';
          }
          
          // UI dependencies
          if (id.includes('node_modules/lucide-react/') ||
              id.includes('node_modules/react-toastify/') ||
              id.includes('node_modules/react-dropzone/')) {
            return 'vendor-ui';
          }
          
          // Utility dependencies
          if (id.includes('node_modules/date-fns/') ||
              id.includes('node_modules/uuid/')) {
            return 'vendor-utils';
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      '@solana/web3.js',
      '@solana/spl-token',
      'lucide-react',
      'react-toastify',
      'react-dropzone',
      'date-fns',
      'uuid'
    ],
    esbuildOptions: {
      target: 'esnext'
    }
  }
});