import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import compression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 5500,
  },
  plugins: [
    react(),
    // Gzip compression for production builds
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli compression for production builds (better compression)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    // Bundle analyzer (only in build mode)
    ...(process.env.ANALYZE ? [visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable code splitting for better performance
    rollupOptions: {
      output: {
        // Split vendor libraries into separate chunks
        manualChunks: {
          // Core React libraries
          react: ['react', 'react-dom'],
          // Router
          router: ['react-router-dom'],
          // UI libraries
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-accordion',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
            '@radix-ui/react-switch',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            'lucide-react'
          ],
          // Charts and data visualization (lazy load these)
          charts: ['chart.js', 'react-chartjs-2', 'recharts'],
          // Editor components (lazy load these)
          editor: [
            '@monaco-editor/react',
            '@codesandbox/sandpack-react',
            'grapesjs',
            'grapesjs-blocks-basic',
            'grapesjs-blocks-flexbox',
            'grapesjs-custom-code',
            'grapesjs-plugin-forms',
            'grapesjs-preset-webpage',
            'grapesjs-tabs',
            'react-contenteditable'
          ],
          // Payment processing (lazy load)
          stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          // Form handling
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Utils and smaller libraries
          utils: [
            'axios',
            '@tanstack/react-query',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'date-fns',
            'uuid'
          ]
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console statements in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
    },
    // Set chunk size warning limit
    chunkSizeWarningLimit: 600,
    // Enable source maps for debugging (but smaller ones)
    sourcemap: false, // Disable source maps for better performance
  },
  // Enable CSS code splitting
  css: {
    devSourcemap: false,
    // Optimize CSS for production
    modules: {
      generateScopedName: '[hash:base64:5]', // Shorter class names in production
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom'
    ],
    exclude: [
      // Exclude heavy dependencies that should be loaded on demand
      '@monaco-editor/react',
      'grapesjs',
      'chart.js',
      'html2canvas',
      'jspdf'
    ]
  }
});