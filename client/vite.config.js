import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Cible de l'API surchargée par API_PROXY (défaut : serveur local sur 3000)
      '/api': process.env.API_PROXY || 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist'
  }
});
