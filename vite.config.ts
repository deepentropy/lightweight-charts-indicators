import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'example',
  base: '/lightweight-charts-indicators/',
  publicDir: 'public',
  build: {
    outDir: '../dist-example',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      'lightweight-charts-indicators': resolve(__dirname, 'src/index.ts'),
    },
  },
});
