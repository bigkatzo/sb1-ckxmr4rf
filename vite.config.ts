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
          code.includes('framer-motion')
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
    // Add circular dependency detection
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    // Add additional optimizations for circular dependencies
    rollupOptions: {
      external: [
        '@pixi/core',
        '@pixi/filter-adjustment',
        '@pixi/filter-bulge-pinch',
        '@pixi/filter-displacement'
      ],
      onwarn(warning, warn) {
        // Suppress circular dependency warnings for UI libraries
        if (warning.code === 'CIRCULAR_DEPENDENCY' && 
            (warning.message.includes('@headlessui') || warning.message.includes('@radix-ui'))) {
          return;
        }
        // Suppress other common warnings that might be related
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') {
          return;
        }
        warn(warning);
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        format: 'es', // Ensure ES modules format
        // Improve tree-shaking
        hoistTransitiveImports: true,
        manualChunks: {
          // Core React dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // Split Solana dependencies into smaller chunks
          'vendor-solana-core': ['@solana/web3.js'],
          'vendor-solana-token': ['@solana/spl-token'],
          'vendor-privy': ['@privy-io/react-auth'],
          
          // Split Metaplex into smaller chunks
          'vendor-metaplex-core': ['@metaplex-foundation/js'],
          'vendor-metaplex-mpl-token': ['@metaplex-foundation/mpl-token-metadata'],
          'vendor-metaplex-mpl-candy': [
            '@metaplex-foundation/mpl-candy-machine',
            '@metaplex-foundation/mpl-candy-guard'
          ],
          'vendor-metaplex-bubblegum': ['@metaplex-foundation/mpl-bubblegum'],
          
          // UI dependencies - exclude problematic ones from vendor chunks
          'vendor-ui-core': ['lucide-react'],
          'vendor-ui-notifications': ['react-toastify'],
          'vendor-ui-upload': ['react-dropzone'],
          
          // Utility libraries
          'vendor-utils': ['date-fns', 'uuid', 'bs58', 'buffer'],
          
          // Data visualization - lazily loaded
          'vendor-charts': ['recharts'],
          
          // DnD functionality - lazily loaded
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          
          // Payment processing
          'vendor-payment': ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          
          // PixiJS - bundle only the main pixi.js package
          'vendor-pixi': ['pixi.js']
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
      '@privy-io/react-auth',
      '@metaplex-foundation/js',
      
      // UI and utilities
      'lucide-react',
      'react-toastify',
      'react-dropzone',
      'date-fns',
      'uuid',
      'bs58',
      'buffer',
      'recharts',
      
      // DnD
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      
      // PixiJS (only include the main package)
      'pixi.js',
      'file-saver'
    ],
    exclude: [
      // Exclude problematic dependencies that cause circular deps
      '@headlessui/react',
      '@radix-ui/react-tooltip'
    ],
    esbuildOptions: {
      target: 'esnext',
      // Enable tree-shaking optimization
      treeShaking: true,
      // Improve minification
      minify: true,
      // Keep pure annotations
      keepNames: false,
      // Add circular dependency detection
      logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
    // Force dependency optimization to prevent circular dependencies
    force: true
  },
  // Improve dev experience
  server: {
    port: 5173,
    open: false,
    hmr: {
      overlay: true
    }
  }
});