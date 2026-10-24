import { defineConfig } from 'vite';

// `vite build --mode poki` / `--mode crazygames` make the versions for those game portals:
// same game, plus the portal's SDK (ads between sessions, gameplay start/stop) and their own output folder.
const PORTAL_SDKS = {
  poki: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js',
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
};
const portalSdk = (src) => ({
  name: 'portal-sdk',
  transformIndexHtml: () => [{ tag: 'script', attrs: { src }, injectTo: 'head-prepend' }],
});

export default defineConfig(({ mode }) => ({
  base: './',
  server: { port: 5173, open: false },
  plugins: PORTAL_SDKS[mode] ? [portalSdk(PORTAL_SDKS[mode])] : [],
  build: {
    outDir: PORTAL_SDKS[mode] ? `dist-${mode}` : 'dist',
    chunkSizeWarningLimit: 1200,
  },
}));
