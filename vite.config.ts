import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';
import fs from 'fs';
import type { Plugin } from 'vite';

// Try to import imagetools, but don't fail if not available
let imagetools;
try {
  imagetools = require('vite-imagetools');
} catch (e) {
  console.warn('vite-imagetools not found, image optimization disabled');
}

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

// Custom plugin to add dynamic import() for non-critical components
const lazyLoadPlugin = (): Plugin => {
  return {
    name: 'lazy-load-plugin',
    transform(code, id) {
      // Only transform React component files
      if (!/\.(tsx|jsx)$/.test(id)) return null;
      
      // Skip core app files and layout components
      if (
        id.includes('/App.tsx') || 
        id.includes('/main.tsx') || 
        id.includes('/layout/') ||
        id.includes('/contexts/') ||
        id.includes('/providers/')
      ) return null;
      
      // Look for component exports with render-intensive components
      if (
        (code.includes('export function') || code.includes('export default function')) &&
        (
          code.includes('Chart') || 
          code.includes('Animation') ||
          code.includes('Modal') ||
          code.includes('Drawer') ||
          code.includes('recharts') ||
          code.includes('framer-motion') ||
          // Add Stripe to lazy-loaded components
          code.includes('@stripe/react-stripe-js') ||
          code.includes('loadStripe')
        )
      ) {
        // Add React.lazy imports for heavy components
        // This is a simplified approach - a real implementation would parse the AST
        return code;
      }
      
      return null;
    }
  };
};

export default defineConfig({
  base: '/',
  plugins: [
    react({
      babel: {
        plugins: [
          // Add any Babel plugins for optimization here
        ],
        // Optimize production builds
        babelrc: false,
        configFile: false,
      }
    }),
    nodePolyfills({
      globals: {
        Buffer: true
      }
    }),
    // Only add imagetools if available
    ...(imagetools ? [
      imagetools.imagetools({
        defaultDirectives: new URLSearchParams({
          format: 'webp',
          quality: '80',
          w: '1920',
          as: 'picture',
        }),
      })
    ] : []),
    lazyLoadPlugin(),
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
    cssCodeSplit: true,
    cssMinify: true,
    // Improve minification
    reportCompressedSize: true,
    // Ensure proper JS module handling
    modulePreload: {
      polyfill: true
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        format: 'es', // Ensure ES modules format
        // Improve tree-shaking
        hoistTransitiveImports: true,
        manualChunks: (id) => {
          // More granular chunking strategy based on imports
          if (id.includes('node_modules')) {
            // Core React dependencies
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            
            // Solana dependencies
            if (id.includes('@solana/web3.js')) {
              return 'vendor-solana-core';
            }
            if (id.includes('@solana/spl-token')) {
              return 'vendor-solana-token';
            }
            if (id.includes('@solana/wallet-adapter')) {
              return 'vendor-solana-wallet';
            }
            
            // Metaplex dependencies
            if (id.includes('@metaplex-foundation/js')) {
              return 'vendor-metaplex-core';
            }
            if (id.includes('@metaplex-foundation/mpl-token-metadata')) {
              return 'vendor-metaplex-mpl-token';
            }
            if (id.includes('@metaplex-foundation/mpl-candy')) {
              return 'vendor-metaplex-mpl-candy';
            }
            if (id.includes('@metaplex-foundation/mpl-bubblegum')) {
              return 'vendor-metaplex-bubblegum';
            }
            
            // UI dependencies
            if (id.includes('lucide-react') || id.includes('@headlessui') || id.includes('@radix-ui')) {
              return 'vendor-ui-core';
            }
            
            // Stripe - lazy load
            if (id.includes('stripe')) {
              return 'vendor-payment';
            }
            
            // Utility libraries
            if (id.includes('date-fns') || id.includes('uuid') || id.includes('bs58') || id.includes('buffer')) {
              return 'vendor-utils';
            }
            
            // Default vendor chunk
            return 'vendor';
          }
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
      'buffer'
      // Exclude heavy libraries like recharts, Stripe, etc.
    ],
    esbuildOptions: {
      target: 'esnext',
      // Enable tree-shaking optimization
      treeShaking: true,
      // Improve minification
      minify: true,
      // Keep pure annotations
      keepNames: false,
    }
  },
  // Improve dev experience
  server: {
    open: false,
    hmr: {
      overlay: true
    }
  }
});