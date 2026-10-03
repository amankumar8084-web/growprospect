import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    // Force all packages to share a single React instance.
    // Prevents "Invalid hook call" from lucide-react, @dnd-kit, etc.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
