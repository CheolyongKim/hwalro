import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 개발 서버에서는 regulation-service로 API 요청을 전달해 CORS 설정을 추가하지 않는다.
    proxy: {
      '/api': 'http://localhost:8082',
    },
  },
});
