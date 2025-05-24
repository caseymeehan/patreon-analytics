import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcssVite from '@tailwindcss/vite'; 

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcssVite(), 
  ],
  server: { 
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // secure: false, // uncomment if your backend is not on https
      }
    }
  }
});
