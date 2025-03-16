import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';
import fs from 'fs';
import type { Plugin } from 'vite';

// Custom plugin to handle service worker
const serviceWorkerPlugin = (): Plugin => {
  return {
    name: 'service-worker-plugin',
    apply: 'build', // Only apply during build
    closeBundle: {
      sequential: true,
      order: 'post' as const,
      handler() {
        // Copy service worker directly without transformation
        const srcPath = resolve(__dirname, 'public/service-worker.js');
        const destPath = resolve(__dirname, 'dist/service-worker.js');
        
        if (fs.existsSync(srcPath)) {
          const content = fs.readFileSync(srcPath, 'utf-8');
          fs.writeFileSync(destPath, content);
          console.log('Service worker copied to dist/service-worker.js');
        } else {
          console.error('Service worker source file not found at', srcPath);
        }
      }
    }
  };
};

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true
      }
    }),
    serviceWorkerPlugin()
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
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks: {
          // Core React dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // Split Solana dependencies into smaller chunks
          'vendor-solana-core': ['@solana/web3.js'],
          'vendor-solana-token': ['@solana/spl-token'],
          'vendor-solana-wallet': [
            '@solana/wallet-adapter-base',
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-react-ui',
            '@solana/wallet-adapter-wallets'
          ],
          'vendor-metaplex': ['@metaplex-foundation/js'],
          
          // UI dependencies
          'vendor-ui': ['lucide-react', 'react-toastify', 'react-dropzone', '@headlessui/react', '@radix-ui/react-tooltip'],
          
          // Utility libraries
          'vendor-utils': ['date-fns', 'uuid', 'bs58', 'buffer'],
          
          // Data visualization
          'vendor-charts': ['recharts'],
          
          // DnD functionality
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities']
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      // Core dependencies
      'react', 
      'react-dom', 
      'react-router-dom',
      
      // Solana ecosystem
      '@solana/web3.js',
      '@solana/spl-token',
      '@solana/wallet-adapter-base',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      '@solana/wallet-adapter-wallets',
      '@metaplex-foundation/js',
      
      // UI and utilities
      'lucide-react',
      'react-toastify',
      'react-dropzone',
      '@headlessui/react',
      '@radix-ui/react-tooltip',
      'date-fns',
      'uuid',
      'bs58',
      'buffer',
      'recharts',
      
      // DnD
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities'
    ],
    esbuildOptions: {
      target: 'esnext'
    }
  }
});