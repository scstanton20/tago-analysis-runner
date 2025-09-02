import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'fs';

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

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React dependencies
          'react-vendor': ['react', 'react-dom'],
          // Mantine UI library
          'mantine': [
            '@mantine/core',
            '@mantine/hooks',
            '@mantine/form',
            '@mantine/notifications',
            '@mantine/modals',
            '@mantine/dropzone',
          ],
          // CodeMirror editor
          'codemirror': [
            'codemirror',
            '@codemirror/lang-javascript',
            '@codemirror/merge',
            '@codemirror/state',
            '@codemirror/view',
            '@fsegurai/codemirror-theme-vscode-dark',
            '@fsegurai/codemirror-theme-vscode-light',
          ],
          // Drag and drop
          'dnd': [
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            '@dnd-kit/utilities',
          ],
          // Other utilities
          'utils': [
            'diff',
            'sanitize-filename',
            'react-use',
          ],
          // Icons
          'icons': ['@tabler/icons-react'],
          // Auth
          'auth': ['better-auth'],
        },
      },
    },
    // Increase chunk size warning limit for vendor chunks
    chunkSizeWarningLimit: 600,
  },
});
