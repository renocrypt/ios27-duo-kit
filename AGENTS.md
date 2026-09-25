# iOS 27 Duo Kit — agent rules

iOS 27 Duo Kit (live at https://duo.renocrypt.com): a web UI kit for iPhone Duo and iOS 27, whose showcase is a concept prototype of iPhone Duo reimagined as a centralized personal hub, shown on the web as a realistic 3D device (Three.js) whose screens run Duo's system UI (DOM and SVG through HTML-in-Canvas), with motion by Anime.js. `README.md` is the map.

## Laws

- **Knowledge lives in this folder.** Findings, decisions, and what is next go into the file they belong to before a session ends. Agents keep no private memory: Claude Code's auto memory is off (`.claude/settings.local.json`).
- **Chrome is the only browser.** The Chrome the chrome-devtools MCP drives (Chrome 154, macOS, Apple silicon, `127.0.0.1:9223`), with `chrome://flags/#canvas-draw-element` on. Verify visual work there, with screenshots, before calling it done.
- **Two sources of truth.** Design values live in `app/tokens/` (DTCG), device geometry in `app/src/device/spec.ts`. Never hardcode a value either holds; add a token.
- **Every value states its source**: Apple-published, [KIT] (Apple's iOS 27 UI Kit), [SIM] (Xcode's iPhone Duo simulator: its device profile, or what the real renderer draws in it), measured, derived, or our choice [C].
- **Apple's assets never enter the repository.** They live in `.references/`, which git ignores (below); only numbers, descriptions, and citations come in. Our device, icons, and artwork are drawn by us: what we draw from measurements is ours, however close to Apple's; Apple's own files and drawings are not.
- **Build for reuse.** Modules are self-contained and document their API in a header comment. A task done twice becomes a tool.
- **English** for code, comments, and docs.

## Reading budget

Read the map (`README.md`), then only what the task needs. Module headers document their API: read the header, not the whole file.

| Task | Read |
| --- | --- |
| Screens, system UI | `docs/duo-ui.md` (sections 1 and 2), the headers of `app/src/kit/chrome.ts`, `status.ts`, `icons.ts` |
| Liquid Glass | `docs/liquid-glass.md`, the header of `app/src/glass/GlassCompositor.ts`; to measure iOS's own, the headers of `app/tools/glass-probe/probe.ts` and `app/src/labs/probe/calibrate.ts` |
| Device model | `app/src/device/spec.ts`, `docs/research/2026-09-23-device-geometry-pass.md` |
| The journey | `docs/presentation.md`, `app/src/journey/scenes.ts` |
| Concept, copy | `docs/hub.md` |

Skip unless a task is about them: `app/src/tokens/` and `app/tokens/glass.sim.tokens.json` (generated), `app/src/device/foldTable.json` (generated), `docs/research/` (dated evidence; open a note only to cite it), `.references/` (reference material; open a file only when a task needs it), `node_modules/`, `dist/`.

## Verify

- `npm run check` in `app/`: tokens, types, the hinge sweep, the production build.
- The dev server is `127.0.0.1:5190`. Inside Claude Code's sandbox, start it with `DUO_POLL=1 npm run dev`: file events do not reach the sandbox, and without polling it serves stale modules. On the presentation, `window.duo` holds `{ stage, journey, surfaces }`; the progress rail's buttons jump between scenes. Dev labs are listed in `app/README.md`.
- Git: `github.com/renocrypt/ios27-duo-kit` (public), branch `main`. Every push to `main` deploys `app/` to GitHub Pages (`.github/workflows/pages.yml`), served at https://duo.renocrypt.com (DNS: a CNAME `duo` → `renocrypt.github.io`, not proxied, in the renocrypt.com zone, managed from `~/dev/containers/armada/edge/cloudflare/`). Inside Claude Code's sandbox, commits work; pushing and `gh` do not (the token is in the Keychain, and TLS cannot be verified there), so run them outside it.
- Screenshots are for the agent's own checks: take them with the chrome-devtools MCP, keep them in `/tmp/duo/<task>/`, never in this folder, and report in words what they show; the owner does not need them. The MCP writes only inside the workspace, so save to `.shots/` there (ignored) and move the file to `/tmp/duo/<task>/` at once. Scratch files go to `/tmp/duo/<task>/` too.
- The glass probe keeps its captures in `.references/glass-probe/captures/<device>-<os>-<display>/<set>/` (iOS; `npm run probe` rebuilds them) and its disposable output in `/tmp/duo/glass-probe/`: `inspect/<date>/` (pictures to look at, from `?calibrate`), `scratch/`, and `build/`. Its report of residuals is ours: `app/tools/glass-probe/report.json`, next to the tokens it explains.

## Reference library (outside the repository)

`.references/`, next to `app/` and ignored by git (never commit it): `apple-model/` (Apple's AR model as USDZ, and the GLBs `app/tools/usd/usd_to_glb.py` exports from it), `apple-web/` (`images/`: HIG, newsroom, and product-page figures; `pages/`: Apple's pages and the Accessory Design Guidelines as saved; `docs/`: Apple's documentation as JSON and Markdown, and talk transcripts), `ui-kit/` (the two status-bar frames exported by hand from Apple's iOS 27 UI Kit), `owner/` (the owner's reference images, [R1] and [R2] in `docs/duo-ui.md`; their source is not recorded, so they cannot be fetched again), and `glass-probe/captures/` (Liquid Glass as the iOS simulator renders it). The dev server serves allowlisted files from it to the labs (`app/tools/vite-plugin-reference.ts`). Where the files come from is in `docs/research/2026-09-23-device-physical-reference/SOURCES.md` and the notes that cite them; the USDZ is also archived at github.com/agarwalmukul/iPhoneDuo (the same SHA-256). `/tmp/duo/<task>/` holds only screenshots and scratch, which macOS removes after three days untouched.
