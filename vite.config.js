import { defineConfig } from 'vite';

// `vite build --mode poki` makes the version for Poki: same game, plus the Poki SDK
// (ads between sessions, gameplay start/stop) and its own output folder.
const pokiSdk = {
  name: 'poki-sdk',
  transformIndexHtml: () => [
    { tag: 'script', attrs: { src: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js' }, injectTo: 'head-prepend' },
  ],
};

export default defineConfig(({ mode }) => ({
  base: './',
  server: { port: 5173, open: false },
  plugins: mode === 'poki' ? [pokiSdk] : [],
  build: {
    outDir: mode === 'poki' ? 'dist-poki' : 'dist',
    chunkSizeWarningLimit: 1200,
  },
}));
