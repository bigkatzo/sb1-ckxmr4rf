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
  define: {
    'process.env': {},
  },
  envPrefix: ['VITE_'],
  build: {
    sourcemap: false,
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-solana': ['@solana/web3.js', '@solana/spl-token', '@metaplex-foundation/js'],
          'vendor-ui': ['lucide-react', 'react-toastify', 'react-dropzone'],
          'vendor-utils': ['date-fns', 'uuid']
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
      '@metaplex-foundation/js',
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