/**
 * Dev-only Vite plugin: serves Apple reference material from /tmp/duo/ to our internal comparison
 * tools. The files never enter the project and are never bundled: this plugin only exists on the
 * dev server, and each route serves an allowlist of file names.
 *
 *   /@reference/<name>.glb      Apple's AR model per pose (/tmp/duo/reference/, exported by
 *                               tools/usd/usd_to_glb.py), for compare/
 *   /@reference/kit/<name>.svg  frames exported from Apple's iOS 27 UI Kit (/tmp/duo/ios27-kit/),
 *                               for labs/glyphs.html
 *   /@reference/probe/catalog.json, /@reference/probe/<device>/<set>/<scene>/<capture>.png|.json
 *                               Liquid Glass as the iOS simulator renders it (/tmp/duo/glass-probe/captures/,
 *                               captured by tools/glass-probe/probe.ts), for labs/probe.html
 *
 * And two writes, for labs/probe.html?calibrate only: POST /@probe/tokens (JSON) replaces
 * tokens/glass.sim.tokens.json, the [SIM] values it derives; POST /@probe/report (JSON) replaces
 * tools/glass-probe/report.json, every residual of that calibration (our numbers, so they are kept
 * with the tokens); POST /@probe/image?name=<folder>/<name> ({ png: data URL }) writes
 * /tmp/duo/glass-probe/inspect/<folder>/<name>.png, for looking at afterwards.
 */
import type { Plugin } from 'vite';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROUTES: { prefix: string; dir: string; allow: RegExp }[] = [
  { prefix: '/@reference/kit/', dir: '/tmp/duo/ios27-kit', allow: /^[\w .-]+\.svg$/ },
  { prefix: '/@reference/probe/', dir: '/tmp/duo/glass-probe/captures', allow: /^(catalog\.json|[\w.-]+\/[\w.-]+\/(index\.json|[\w-]+\/[\w-]+\.(png|json)))$/ },
  { prefix: '/@reference/', dir: '/tmp/duo/reference', allow: /^apple-duo-(closed|landscape)\.glb$/ },
];
const TYPES: Record<string, string> = { svg: 'image/svg+xml', glb: 'model/gltf-binary', png: 'image/png', json: 'application/json' };

export function referencePlugin(): Plugin {
  return {
    name: 'duo-reference',
    apply: 'serve',
    configureServer(server) {
      const body = (req: import('node:http').IncomingMessage) => new Promise<string>((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });
      server.middlewares.use('/@probe/', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const url = new URL(req.url ?? '', 'http://x');
        const json = JSON.parse(await body(req)); // throws on anything but JSON
        let file: string;
        if (url.pathname === '/image' && /^[\w.-]+\/[\w.-]+$/.test(url.searchParams.get('name') ?? '')) {
          file = join('/tmp/duo/glass-probe/inspect', `${url.searchParams.get('name')}.png`);
          mkdirSync(join(file, '..'), { recursive: true });
          writeFileSync(file, Buffer.from(String(json.png).replace(/^data:image\/png;base64,/, ''), 'base64'));
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ written: file }));
        }
        if (url.pathname === '/tokens') file = resolve(server.config.root, 'tokens', 'glass.sim.tokens.json');
        else if (url.pathname === '/report') file = resolve(server.config.root, 'tools', 'glass-probe', 'report.json');
        else return next();
        writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ written: file }));
      });
      for (const route of ROUTES) {
        server.middlewares.use(route.prefix, (req, res, next) => {
          const name = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0]);
          const file = join(route.dir, name);
          if (!route.allow.test(name) || !existsSync(file)) return next();
          res.setHeader('Content-Type', TYPES[name.split('.').pop()!]);
          res.setHeader('Cache-Control', 'no-store');
          createReadStream(file).pipe(res);
        });
      }
    },
  };
}
