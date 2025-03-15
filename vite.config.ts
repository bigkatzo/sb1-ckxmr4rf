import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: '/',
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