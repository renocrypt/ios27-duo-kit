/**
 * Vite plugin: compiles tokens/*.tokens.json on startup and again whenever a token file changes,
 * so edits to a token reach the page through normal CSS hot reload.
 */
import type { Plugin } from 'vite';
import { compile, TOKENS_DIR } from './tokens.ts';

export function tokensPlugin(): Plugin {
  const run = (log: (m: string) => void) => {
    const { warnings, count } = compile();
    for (const w of warnings) log(`tokens warning: ${w}`);
    return count;
  };
  return {
    name: 'duo-tokens',
    buildStart() {
      run((m) => this.warn(m));
    },
    configureServer(server) {
      server.watcher.add(TOKENS_DIR);
      server.watcher.on('change', (file) => {
        if (!file.startsWith(TOKENS_DIR) || !file.endsWith('.tokens.json')) return;
        try {
          const count = run((m) => server.config.logger.warn(m));
          server.config.logger.info(`tokens: recompiled ${count}`, { timestamp: true });
        } catch (error) {
          server.config.logger.error(`tokens: ${(error as Error).message}`, { timestamp: true });
        }
      });
    },
  };
}
