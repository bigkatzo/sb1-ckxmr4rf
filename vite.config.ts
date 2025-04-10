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
        try {
          // Ensure dist directory exists
          if (!fs.existsSync('dist')) {
            fs.mkdirSync('dist', { recursive: true });
            console.log('Created dist directory');
            return; // Exit early as build hasn't completed yet
          }

          // Read package.json for base version
          const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
          const baseVersion = packageJson.version;
          
          // Generate content hash from dist directory
          const distFiles = fs.readdirSync('dist');
          if (!distFiles.length) {
            console.log('Dist directory is empty, waiting for build to complete');
            return;
          }

          const mainJsFile = distFiles.find(file => file.startsWith('assets/index-') && file.endsWith('.js'));
          const buildHash = mainJsFile ? mainJsFile.split('-')[1].split('.')[0] : Date.now().toString(36);
          const buildVersion = `${baseVersion}+${buildHash}`;

          // Copy and transform service worker
          const srcPath = resolve(__dirname, 'public/service-worker.js');
          const destPath = resolve(__dirname, 'dist/service-worker.js');
          
          if (fs.existsSync(srcPath)) {
            let content = fs.readFileSync(srcPath, 'utf-8');
            
            // Replace the version constant with the build version
            content = content.replace(
              /const APP_VERSION = ['"].*?['"];/,
              `const APP_VERSION = '${buildVersion}';`
            );
            
            fs.writeFileSync(destPath, content);
            console.log(`Service worker copied to dist/service-worker.js with version ${buildVersion}`);
          } else {
            console.warn('Service worker source file not found at', srcPath);
          }
        } catch (error) {
          console.error('Error in service worker plugin:', error);
          // Don't throw to allow build to complete
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
    chunkSizeWarningLimit: 1500,
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
          
          // Split Metaplex into smaller chunks
          'vendor-metaplex-core': ['@metaplex-foundation/js'],
          'vendor-metaplex-mpl-token': ['@metaplex-foundation/mpl-token-metadata'],
          'vendor-metaplex-mpl-candy': [
            '@metaplex-foundation/mpl-candy-machine',
            '@metaplex-foundation/mpl-candy-guard'
          ],
          'vendor-metaplex-bubblegum': ['@metaplex-foundation/mpl-bubblegum'],
          
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