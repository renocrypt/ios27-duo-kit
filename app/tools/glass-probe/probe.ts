/**
 * Glass probe driver: builds Probe.swift against the iOS simulator SDK, runs it on an iPhone Duo
 * simulator, and captures the sets in scenes.json (each scene, at a position of Settings > Liquid
 * Glass's slider), so Liquid Glass as iOS renders it can be measured (docs/liquid-glass.md).
 *
 *   npm run probe                                     # build, then capture every set
 *   node tools/glass-probe/probe.ts --set default edge   # one set, one scene (* wildcards)
 *   node tools/glass-probe/probe.ts --no-build --device "iPhone 18 Pro" --set default
 *
 * Output, outside this folder: /tmp/duo/glass-probe/captures/<device>-<os>-<display>/<set>/<scene>/
 * ref.png (the stimulus alone) and glass-<phase>.png, each with the probe's layout report (.json),
 * and captures/catalog.json listing every set (read by labs/probe.html). The slider is set with
 * UIKit's UIViewGlassTintAmount and restored afterwards. Each capture is taken from the display
 * whose pixels match the probe's window (Duo has two; simctl's default is the inner one).
 * Needs Xcode with the iPhone Duo simulator (Xcode 27.1 beta, iOS 27.1 runtime); simctl needs
 * CoreSimulator's Mach services, outside Claude Code's sandbox unless it allows them.
 * The display is the one the device shows: a freshly booted Duo is folded (outer, 466 × 678 pt), and
 * simctl cannot unfold it (Simulator's menus can), so scenes meant for both fit the outer window.
 * If simctl hangs while the device reports Booted (even get_app_container), `xcrun simctl shutdown
 * "Duo Probe"` and run again.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = '/tmp/duo/glass-probe';
const APP = join(OUT, 'build', 'Probe.app');
const BUNDLE = 'studio.duo.glassprobe';
const DEVICE = 'Duo Probe';
const DEVICE_TYPE = 'com.apple.CoreSimulator.SimDeviceType.iPhone-Duo';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const option = (name: string) => { const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1]; };
const display = option('--display');
const deviceName = option('--device') ?? DEVICE;
const onlySet = option('--set');
const patterns = argv.filter((a, i) => !a.startsWith('--') && !['--display', '--device', '--set'].includes(argv[i - 1] ?? ''));
const glob = (p: string, id: string) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(id);

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const simctl = (...args: string[]) => run('xcrun', ['simctl', ...args]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const plist = (minOS: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>${BUNDLE}</string>
  <key>CFBundleExecutable</key><string>Probe</string>
  <key>CFBundleName</key><string>Glass Probe</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>CFBundleSupportedPlatforms</key><array><string>iPhoneSimulator</string></array>
  <key>MinimumOSVersion</key><string>${minOS}</string>
  <key>UIDeviceFamily</key><array><integer>1</integer></array>
  <key>UILaunchScreen</key><dict/>
  <key>UISupportedInterfaceOrientations</key><array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
  </array>
</dict></plist>
`;

/** Builds against the SDK in Xcode, with the device's OS as the minimum. */
function build(minOS: string) {
  mkdirSync(APP, { recursive: true });
  run('xcrun', ['-sdk', 'iphonesimulator', 'swiftc', '-parse-as-library', '-O',
    '-target', `arm64-apple-ios${minOS}-simulator`, '-module-cache-path', join(OUT, 'build', 'cache'),
    join(HERE, 'Probe.swift'), '-o', join(APP, 'Probe')]);
  writeFileSync(join(APP, 'Info.plist'), plist(minOS));
  copyFileSync(join(HERE, 'scenes.json'), join(APP, 'scenes.json'));
  run('codesign', ['--force', '--sign', '-', APP]);
  console.log('built', APP);
}

/** The simulator (the probe's own Duo is created on first use) and its OS version. */
function device(): { udid: string; os: string } {
  const find = () => {
    const list = JSON.parse(simctl('list', 'devices', '-j')).devices as Record<string, { name: string; udid: string; isAvailable: boolean }[]>;
    for (const [runtime, devices] of Object.entries(list)) {
      const d = devices.find((q) => q.name === deviceName && q.isAvailable);
      if (d) return { udid: d.udid, os: runtime.replace(/.*iOS-/, '').replace(/-/g, '.') };
    }
    return null;
  };
  let found = find();
  if (!found && deviceName === DEVICE) { simctl('create', DEVICE, DEVICE_TYPE); found = find(); console.log('created', DEVICE); }
  if (!found) throw new Error(`no available simulator named ${deviceName}`);
  return found;
}

/** The device's framebuffer displays: port UUID and size in pixels. */
function displays(udid: string): { uuid: string; w: number; h: number }[] {
  const out: { uuid: string; w: number; h: number }[] = [];
  let uuid = '', port = '', w = 0;
  for (const line of simctl('io', udid, 'enumerate').split('\n')) {
    const m = line.match(/^\s*(UUID|Port Identifier|Default width|Default height):\s*(.+)$/);
    if (!m) continue;
    if (m[1] === 'UUID') { uuid = m[2].trim(); port = ''; }
    else if (m[1] === 'Port Identifier') port = m[2].trim();
    else if (m[1] === 'Default width') w = Number(m[2]);
    else if (port === 'com.apple.framebuffer.display') out.push({ uuid, w, h: Number(m[2]) });
  }
  return out;
}

/** The display showing the probe's window. */
function displayFor(screens: { uuid: string; w: number; h: number }[], report: { width: number; height: number; scale: number }) {
  const w = Math.round(report.width * report.scale), h = Math.round(report.height * report.scale);
  return screens.find((d) => (d.w === w && d.h === h) || (d.w === h && d.h === w))?.uuid;
}

let screens: { uuid: string; w: number; h: number }[] = [];

async function capture(udid: string, ready: string, scene: string, phase: number, glass: boolean, file: string) {
  rmSync(ready, { force: true });
  simctl('launch', '--terminate-running-process', udid, BUNDLE, '-scene', scene, '-phase', String(phase), '-glass', glass ? '1' : '0');
  const t0 = Date.now();
  while (!existsSync(ready)) {
    if (Date.now() - t0 > 20000) throw new Error(`${scene}: the probe never reported ready`);
    await sleep(100);
  }
  await sleep(250);
  const report = JSON.parse(readFileSync(ready, 'utf8'));
  const target = display ?? displayFor(screens, report);
  simctl('io', udid, 'screenshot', '--mask=ignored', ...(target ? [`--display=${target}`] : []), `${file}.png`);
  writeFileSync(`${file}.json`, JSON.stringify(report, null, 1));
  return report;
}

/** Settings > Liquid Glass's slider: read, set (a number, or "default" to remove it as on an untouched device). */
function tintOf(udid: string): string {
  try { return simctl('spawn', udid, 'defaults', 'read', 'com.apple.UIKit', 'UIViewGlassTintAmount').trim(); } catch { return 'default'; }
}
function setTint(udid: string, tint: string) {
  const defaults = (...args: string[]) => { try { simctl('spawn', udid, 'defaults', ...args); } catch { /* absent key */ } };
  if (tint === 'default') { defaults('delete', 'com.apple.UIKit', 'UIViewGlassTintAmount'); defaults('delete', 'com.apple.UIKit', 'UIViewGlassEverEditedInSettings'); }
  else { defaults('write', 'com.apple.UIKit', 'UIViewGlassTintAmount', '-float', tint); defaults('write', 'com.apple.UIKit', 'UIViewGlassEverEditedInSettings', '-bool', 'true'); }
}

interface SetDef { tint: number | 'default'; scenes: string[] }

async function main() {
  const { udid, os } = device();
  if (!flag('--no-build')) build(os);
  simctl('bootstatus', udid, '-b');
  simctl('install', udid, APP);
  screens = displays(udid);
  const ready = join(simctl('get_app_container', udid, BUNDLE, 'data').trim(), 'Documents', 'ready.json');
  const file = JSON.parse(readFileSync(join(HERE, 'scenes.json'), 'utf8')) as { scenes: Record<string, { phases?: number }>; sets: Record<string, SetDef> };

  // Where the captures go: the device, its OS, and the display the probe appears on (a folded Duo
  // shows it outside, an open one inside), found with a first launch.
  const probe = await capture(udid, ready, Object.keys(file.scenes)[0], 0, false, join(OUT, 'build', 'first'));
  const shown = deviceName === DEVICE ? (probe.width < 500 ? 'outer' : 'inner') : 'main';
  const slug = `${deviceName === DEVICE ? 'duo' : deviceName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${os}-${shown}`;
  console.log(`${deviceName} (iOS ${os}, ${shown} display, ${probe.width} × ${probe.height} pt) → captures/${slug}/`);

  const before = tintOf(udid);
  const catalogPath = join(OUT, 'captures', 'catalog.json');
  const catalog = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, 'utf8')) : {};
  try {
    for (const [name, set] of Object.entries(file.sets)) {
      if (onlySet && !glob(onlySet, name)) continue;
      setTint(udid, String(set.tint));
      const ids = Object.keys(file.scenes).filter((id) => set.scenes.some((p) => glob(p, id)) && (!patterns.length || patterns.some((p) => glob(p, id))));
      const index: Record<string, { phases: number; files: string[] }> = {};
      for (const id of ids) {
        const dir = join(OUT, 'captures', slug, name, id);
        mkdirSync(dir, { recursive: true });
        const phases = file.scenes[id].phases ?? 1;
        const files = ['ref'];
        await capture(udid, ready, id, 0, false, join(dir, 'ref'));
        for (let p = 0; p < phases; p++) { await capture(udid, ready, id, p, true, join(dir, `glass-${p}`)); files.push(`glass-${p}`); }
        index[id] = { phases, files };
      }
      const indexPath = join(OUT, 'captures', slug, name, 'index.json');
      const previous = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
      writeFileSync(indexPath, JSON.stringify({ ...previous, ...index }, null, 1));
      catalog[`${slug}/${name}`] = { tint: set.tint === 'default' ? 'default' : set.tint, device: deviceName, os, display: shown,
        window: [probe.width, probe.height], scale: probe.scale, date: new Date().toISOString(), scenes: Object.keys({ ...previous, ...index }) };
      writeFileSync(catalogPath, JSON.stringify(catalog, null, 1));
      console.log(`${slug}/${name} (tint ${set.tint}): ${ids.length} scenes`);
    }
  } finally {
    setTint(udid, before);
    console.log(`slider restored to ${before}`);
  }
}

main().catch((e) => { console.error(e.stderr?.toString() || e.message); process.exit(1); });
