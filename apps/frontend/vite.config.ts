import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 개발 서버에서는 서비스별 프록시를 통해 브라우저의 교차 출처 요청을 피한다.
    proxy: {
      '/api/auth': 'http://localhost:8080',
      '/api': 'http://localhost:8082',
    },
  },
});
