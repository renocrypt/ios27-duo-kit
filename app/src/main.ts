/**
 * The presentation: "a day with Duo", a scroll-driven journey (src/journey/). Development tools
 * live on their own pages: /labs/stage.html, /labs/screens.html, /labs/inspect.html, /labs/compare.html, /labs/glass.html, /labs/specimen.html.
 */
import './base.css';
import { Stage } from './scene/Stage.ts';
import { ScreenSurface } from './surface/ScreenSurface.ts';
import { DUO } from './device/spec.ts';
import { Journey } from './journey/Journey.ts';
import { scenes } from './journey/scenes.ts';
import { screensNotice, sourcePill } from './journey/pageChrome.ts';

const REPO = 'https://github.com/renocrypt/ios27-duo-kit';

const root = document.getElementById('stage')!;
// Without HTML-in-Canvas the device still renders, with dark screens; a note says how to see them.
const journey = new Journey(root, scenes);
const surfaces = {
  inner: new ScreenSurface({ native: DUO.inner.canvas, scale: 2 }),
  outer: new ScreenSurface({ native: DUO.outer.canvas, scale: 2 }),
};
const stage = new Stage(journey.viewport, { surfaces });
journey.start(stage, surfaces);
(window as unknown as { duo: unknown }).duo = { stage, journey, surfaces };
sourcePill(REPO);
if (!ScreenSurface.supported) screensNotice();
