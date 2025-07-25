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
    host: true,
    port: 5173,
    // Fix for HTTP 431 "Request Header Fields Too Large"
    hmr: {
      clientErrorOverlay: false
    },
    // Additional server configuration
    cors: true,
    strictPort: false
  }
});
