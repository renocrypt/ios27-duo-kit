import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { tokensPlugin } from './tools/vite-plugin-tokens.ts';
import { referencePlugin } from './tools/vite-plugin-reference.ts';
import { fontsPlugin } from './tools/vite-plugin-fonts.ts';

export default defineConfig({
  plugins: [tokensPlugin(), referencePlugin(), fontsPlugin()],
  // DUO_POLL=1 npm run dev: where file events do not arrive (a sandbox fsevents does not reach,
  // such as Claude Code's), the watcher polls, or edits and new tokens are never served.
  server: { port: 5190, strictPort: true, host: '127.0.0.1', watch: process.env.DUO_POLL ? { usePolling: true, interval: 250 } : undefined },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000, // three.js alone is about 700 kB; the default warns on every build
    rollupOptions: {
      // The production build is the presentation alone. The labs (labs/*.html) are
      // development pages: the dev server serves them, the build leaves them out.
      input: { main: resolve(__dirname, 'index.html') },
    },
  },
});
