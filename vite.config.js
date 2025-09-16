import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Build configuration for production
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    target: 'es2020',

    // Chunk optimization
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          chakra: ['@chakra-ui/react', '@emotion/react', '@emotion/styled'],
          supabase: ['@supabase/supabase-js'],
          utils: ['framer-motion', 'react-window']
        }
      }
    },

    // Build size warnings
    chunkSizeWarningLimit: 1000,
  },

  // Server configuration for Railway
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT) || 5173,
    strictPort: false,
    hmr: {
      port: parseInt(process.env.PORT) || 5173,
    }
  },

  // Preview server configuration (used by Railway)
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT) || 4173,
    strictPort: false,
  },

  // Environment variables configuration
  envPrefix: ['VITE_'],

  // Base path configuration
  base: '/',

  // Asset optimization
  assetsInclude: ['**/*.woff', '**/*.woff2'],

  // Dependencies optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@chakra-ui/react',
      '@emotion/react',
      '@emotion/styled',
      'framer-motion',
      '@supabase/supabase-js'
    ]
  },

  // ESBuild configuration
  esbuild: {
    target: 'es2020',
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },

  // Define global constants
  define: {
    __DEV__: process.env.NODE_ENV === 'development',
    __PROD__: process.env.NODE_ENV === 'production',
  }
})
