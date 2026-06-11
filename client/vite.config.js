import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Port dédié TransacPharma : 5173 (défaut Vite) est souvent pris par un
    // autre projet (ex. appchallenge) → strictPort pour échouer franchement
    // plutôt que glisser silencieusement vers un autre port.
    port: 5183,
    strictPort: true,
    proxy: {
      // Cible de l'API surchargée par API_PROXY (défaut : serveur local sur 3000)
      '/api': process.env.API_PROXY || 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist'
  }
});
