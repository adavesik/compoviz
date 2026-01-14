import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Build configuration
  build: {
    rollupOptions: {
      output: {
        // Split vendor libraries into separate chunks for better browser caching
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-flow': ['@xyflow/react'],
        },
      },
    },
  },

  // Test configuration
  test: {
    globals: true,
    environment: 'happy-dom',
  },
})
