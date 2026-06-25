import { defineConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'localdev-no-store',
      configureServer(server: ViteDevServer) {
        return () => {
          server.middlewares.use((_req, res, next) => {
            res.setHeader(
              'Cache-Control',
              'no-store, no-cache, must-revalidate, proxy-revalidate',
            );
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Surrogate-Control', 'no-store');
            next();
          });
        };
      },
    },
  ],
  base: '/admin/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../admin_dist',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    },
    hmr: {
      host: process.env.VITE_HMR_HOST || 'localhost',
      clientPort: 5173,
    },
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
      interval: Number(process.env.CHOKIDAR_INTERVAL || '100'),
    },
    proxy: {
      '/api': process.env.ADMIN_API_PROXY_TARGET || 'http://localhost:5000',
      '/uploads': process.env.ADMIN_API_PROXY_TARGET || 'http://localhost:5000',
    },
  },
});
