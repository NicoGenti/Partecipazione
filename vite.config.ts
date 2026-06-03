import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {ViteImageOptimizer} from 'vite-plugin-image-optimizer';

export default defineConfig(() => {
  return {
    base: '/Partecipazione/',
    plugins: [
      react(),
      tailwindcss(),
      ViteImageOptimizer({
        jpg: {quality: 80},
        jpeg: {quality: 80},
        png: {quality: 80},
        webp: {lossless: false, quality: 80},
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
