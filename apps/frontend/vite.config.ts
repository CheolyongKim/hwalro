import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 구체적인 경로를 범용 /api보다 먼저 선언한다.
    proxy: {
      '/api/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/admin': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/regulations': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
    },
  },
});
