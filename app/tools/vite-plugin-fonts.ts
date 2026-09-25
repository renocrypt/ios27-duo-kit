/**
 * Dev-only Vite plugin: Apple's fonts from this Mac, for design review in Chrome.
 *
 * Chrome resolves `system-ui` to SF Pro, but not SF Pro Rounded, New York, or SF Mono: the first is
 * a user-installed family Chrome may not enumerate, and macOS keeps the other two as hidden system
 * fonts (".New York", ".SF NS Mono"). This plugin serves an allowlist of font files straight from
 * the Mac's font folders at /@fonts/ and injects @font-face rules that name them the way our
 * tokens do. The files are never copied into the project or bundled: on a production build this
 * plugin does nothing and the token font stacks fall back to system fonts.
 */
import type { Plugin } from 'vite';
import { createReadStream, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIRS = [join(homedir(), 'Library/Fonts'), '/Library/Fonts', '/System/Library/Fonts'];
const ALLOWED = /^(SF-Pro-Rounded-(Ultralight|Thin|Light|Regular|Medium|Semibold|Bold|Heavy|Black)\.otf|NewYork(Italic)?\.ttf|SFNSMono(Italic)?\.ttf)$/;
const WEIGHTS: [string, number][] = [
  ['Ultralight', 100], ['Thin', 200], ['Light', 300], ['Regular', 400], ['Medium', 500],
  ['Semibold', 600], ['Bold', 700], ['Heavy', 800], ['Black', 900],
];

function locate(name: string): string | null {
  for (const dir of DIRS) { const file = join(dir, name); if (existsSync(file)) return file; }
  return null;
}

function fontFaces(): string {
  const rules: string[] = [];
  for (const [w, weight] of WEIGHTS) {
    const file = `SF-Pro-Rounded-${w}.otf`;
    if (locate(file)) rules.push(`@font-face{font-family:"SF Pro Rounded";src:url(/@fonts/${file}) format("opentype");font-weight:${weight};font-display:block}`);
  }
  // Variable fonts: one file covers the weight range.
  if (locate('NewYork.ttf')) rules.push('@font-face{font-family:"New York";src:url(/@fonts/NewYork.ttf) format("truetype");font-weight:400 900;font-display:block}');
  if (locate('NewYorkItalic.ttf')) rules.push('@font-face{font-family:"New York";src:url(/@fonts/NewYorkItalic.ttf) format("truetype");font-weight:400 900;font-style:italic;font-display:block}');
  if (locate('SFNSMono.ttf')) rules.push('@font-face{font-family:"SF Mono";src:url(/@fonts/SFNSMono.ttf) format("truetype");font-weight:300 900;font-display:block}');
  return rules.join('\n');
}

export function fontsPlugin(): Plugin {
  return {
    name: 'duo-apple-fonts',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/@fonts/', (req, res, next) => {
        const name = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0]);
        const file = ALLOWED.test(name) ? locate(name) : null;
        if (!file) return next();
        res.setHeader('Content-Type', name.endsWith('.otf') ? 'font/otf' : 'font/ttf');
        res.setHeader('Cache-Control', 'max-age=3600');
        createReadStream(file).pipe(res);
      });
    },
    transformIndexHtml() {
      return [{ tag: 'style', attrs: { 'data-dev-fonts': '' }, children: fontFaces(), injectTo: 'head-prepend' }];
    },
  };
}
