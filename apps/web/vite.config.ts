import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@pop/shared-types': path.resolve(
        __dirname,
        '../../packages/shared-types/src',
      ),
    },
  },
  server: {
    port: 5173,
    // ngrok / cloudflared tunnel 给外人 demo 用 — 允许 ngrok host 访问 dev server
    // 默认 Vite 4+ 拒绝非 localhost host(防 DNS rebinding)
    host: true,
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.trycloudflare.com', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
