import { defineConfig } from 'vite';

export default defineConfig({
  worker: {
    format: 'es',
  },
  base: '/qysc-web/'
});
