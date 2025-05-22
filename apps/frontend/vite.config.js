import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';

// Docker detection
const isDocker = (() => {
  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
})();

// Base URL for backend
const backendUrl = isDocker ? 'http://backend:3000' : 'http://localhost:3000';
const wsBackendUrl = isDocker ? 'ws://backend:3000' : 'ws://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/status': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: wsBackendUrl,
        ws: true,
      },
    },
  },
});
