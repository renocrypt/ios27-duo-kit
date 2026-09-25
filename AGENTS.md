# Duo — agent rules

A concept prototype: iPhone Duo reimagined as a centralized personal hub, shown on the web as a realistic 3D device (Three.js) whose screens run Duo's system UI (DOM and SVG through HTML-in-Canvas), with motion by Anime.js. `README.md` is the map.

## Laws

- **Knowledge lives in this folder.** Findings, decisions, and what is next go into the file they belong to before a session ends. Agents keep no private memory: Claude Code's auto memory is off (`.claude/settings.local.json`).
- **Chrome is the only browser.** The Chrome the chrome-devtools MCP drives (Chrome 154, macOS, Apple silicon, `127.0.0.1:9223`), with `chrome://flags/#canvas-draw-element` on. Verify visual work there, with screenshots, before calling it done.
- **Two sources of truth.** Design values live in `app/tokens/` (DTCG), device geometry in `app/src/device/spec.ts`. Never hardcode a value either holds; add a token.
- **Every value states its source**: Apple-published, [KIT] (Apple's iOS 27 UI Kit), [SIM] (Xcode's iPhone Duo simulator: its device profile, or what the real renderer draws in it), measured, derived, or our choice [C].
- **Apple's assets never enter this folder.** They stay in `/tmp/duo/` (below); only numbers, descriptions, and citations come in. Our device, icons, and artwork are drawn by us.
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

Skip unless a task is about them: `app/src/tokens/` and `app/tokens/glass.sim.tokens.json` (generated), `app/src/device/foldTable.json` (generated), `docs/research/` (dated evidence; open a note only to cite it), `node_modules/`, `dist/`.

## Verify

- `npm run check` in `app/`: tokens, types, the hinge sweep, the production build.
- The dev server is `127.0.0.1:5190`. Inside Claude Code's sandbox, start it with `DUO_POLL=1 npm run dev`: file events do not reach the sandbox, and without polling it serves stale modules. On the presentation, `window.duo` holds `{ stage, journey, surfaces }`; the progress rail's buttons jump between scenes. Dev labs are listed in `app/README.md`.
- Git: `github.com/renocrypt/duo` (private), branch `main`. Inside Claude Code's sandbox, commits work; pushing and `gh` do not (the token is in the Keychain, and TLS cannot be verified there), so run them outside it.
- Screenshots and scratch files go to `/tmp/duo/<task>/`, never into this folder. The glass probe keeps `/tmp/duo/glass-probe/` in four folders: `captures/<device>-<os>-<display>/<set>/` (iOS), `reports/` (calibration residuals), `inspect/<date>/` (pictures to look at), `scratch/`, plus `build/`.

## Reference library (outside this folder)

`/tmp/duo/`: `duo-hig/` (HIG figures, the owner's reference images, raw research), `ios27-kit/` (frames read from Apple's iOS 27 UI Kit), `reference/` (Apple's AR model as GLB), `device-research/` (the USDZ). The dev server serves allowlisted files from it to the labs (`app/tools/vite-plugin-reference.ts`). Disposable: anything worth keeping is written down here.
