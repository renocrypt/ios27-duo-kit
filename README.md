# Duo

A concept prototype that reimagines iPhone Duo (Apple's foldable, announced September 9, 2026) as a centralized personal hub, presented as "a day with Duo": a scroll-driven web journey around a realistic 3D device whose screens run Duo's system UI. Chrome only. Rules for agents: `AGENTS.md`.

## Map

| Where | What |
| --- | --- |
| `docs/hub.md` | The hub: thesis, structure, posture model, the agent's consent ladder |
| `docs/presentation.md` | The journey: nine scenes, framing, light, motion |
| `docs/duo-ui.md` | Duo's system UI as we build it, to the numbers of Apple's iOS 27 UI Kit |
| `docs/liquid-glass.md` | How we render Liquid Glass |
| `docs/research/2026-09-23-design-system-brief.md` | The first design-system hypothesis (September 23), kept for its reasoning; the two files above supersede it |
| `docs/research/` | Dated evidence behind the briefs and specs; `2026-09-23-source-index.md` lists the sources |
| `app/` | The app: code, tokens, build and check tools, dev labs, status and next (`app/README.md`) |
| `app/tools/usd/` | Scripts that measure Apple's AR model of the device |
| `docs/research/2026-09-23-device-physical-reference/` | The device's values as data (`duo-device-spec.json`), where Apple's files come from (`SOURCES.md`), and the raw output of the model's measurement |

## Purpose

Decided September 25, 2026. Beyond the presentation, Duo is an iPhone Duo and iOS 27 UI kit built on web technology: the device in 3D, its system UI, and Liquid Glass fitted to iOS itself. The owner, other developers, and their AI agents use it as a template to build landing pages for apps and concept mockups to share on the web. The presentation, "a day with Duo," is its first showcase. So the reusable parts come first: each module documents its API for the next developer or agent, and Liquid Glass, the part that is hardest to reproduce, stays measured against iOS.

## Direction

Decided September 23, 2026. A concept prototype, so it may propose system-level behavior beyond what an App Store app can do; departures from Apple's HIG or platform limits are marked. The hub organizes four areas: **time and attention**, **personal knowledge**, **an AI agent** that acts across them with consent, and **ambient and home** in the resting poses. Poses carry intent: the closed outer display is for glancing and quick action, the open inner display is the workspace, and opening or closing moves deeper into or out of the same context. Standing (tent) is ambient; Seated (propped open) is a situational station.
