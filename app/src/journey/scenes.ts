/**
 * "A day with Duo": the journey's scenes (docs/presentation.md, storyboard). Each scene
 * is data: the posture, the camera shot, the light mood, the copy, and what each display shows.
 *
 * `enter` is how the journey arrives at the scene from its neighbour:
 *   'device'   the device moves (a fold, a pick-up); the camera settles a beat later
 *   'cut'      a new moment in the day: a quick dissolve, then everything is simply there
 * Shots use the stage's framing solver (Stage.ts): azimuth and elevation in degrees, a lens in
 * degrees, the fraction of the frame the device fills, and where its centre sits on screen.
 */
import type { PostureName } from '../scene/postures.ts';
import type { MoodName, Shot } from '../scene/Stage.ts';
import type { Rotation } from '../surface/ScreenSurface.ts';
import { views, type View } from '../hub/views.ts';
import { tokens } from '../tokens/tokens.ts';

const fov = tokens.stage.camera.fov;

export interface SceneScreen { view: () => View; rotation: Rotation }

export interface Scene {
  id: string;
  posture: PostureName;
  shot: Shot;
  mood: MoodName;
  enter: 'device' | 'cut';
  copy: { kicker?: string; headline: string; body?: string; place: 'left' | 'right' | 'center'; hero?: boolean };
  inner: SceneScreen;
  outer: SceneScreen;
  /** Scroll within the scene (0..1) drives this, for scenes that change as you scroll. */
  scrub?: 'dawn';
  /** The viewer may turn the device by hand. */
  turn?: boolean;
  /** Scroll length: long scenes hold more scroll. */
  long?: boolean;
}

const off: SceneScreen = { view: views.off, rotation: 0 };

export const scenes: Scene[] = [
  {
    id: 'title', posture: 'closed', mood: 'title', enter: 'cut',
    shot: { azimuth: 0, elevation: 2, fov: fov.tight, fill: 0.62, at: [0.42, 0] },
    copy: { headline: 'The hinge is the attention dial.', body: 'iPhone Duo, reimagined as a personal hub.', place: 'left', hero: true },
    outer: { view: views.titleFace, rotation: 0 }, inner: off,
  },
  {
    id: 'standing-dawn', posture: 'standing', mood: 'night', enter: 'device', scrub: 'dawn', long: true,
    shot: { azimuth: -24, elevation: 5, fov: fov.wide - 2, fill: 0.56, at: [0.34, -0.06] },
    copy: { kicker: 'Standing', headline: 'Quiet, until it isn’t.', body: 'An overnight task just finished. It waited for the light.', place: 'left' },
    outer: { view: () => views.bedside('night', '6:41'), rotation: 270 }, inner: off,
  },
  {
    id: 'closed-glance', posture: 'closed', mood: 'morning', enter: 'device',
    shot: { azimuth: 0, elevation: 4, fov: fov.tight + 2, fill: 0.64, at: [0.36, 0] },
    copy: { kicker: 'Closed', headline: 'A glance is enough.', body: 'Seven things held until nine. One worth an answer now.', place: 'left' },
    outer: { view: views.lockNowNext, rotation: 0 }, inner: { view: views.todayPlan, rotation: 0 },
  },
  {
    id: 'open-plan', posture: 'open', mood: 'day', enter: 'device',
    shot: { azimuth: -10, elevation: 8, fov: fov.default, fill: 0.52, at: [0.22, 0.04] },
    copy: { kicker: 'Open', headline: 'Plan the day.', body: 'The agent proposes. You decide.', place: 'left' },
    outer: { view: views.lockNowNext, rotation: 0 }, inner: { view: views.todayPlan, rotation: 0 },
  },
  {
    id: 'closed-approve', posture: 'closed', mood: 'office', enter: 'cut',
    shot: { azimuth: 12, elevation: 16, fov: fov.tight + 2, fill: 0.64, at: [-0.36, 0] },
    copy: { kicker: 'Closed', headline: 'Busy in the background.', body: 'One thing needs your touch: the side button, not the screen.', place: 'right' },
    outer: { view: views.liveApproval, rotation: 0 }, inner: { view: views.todayPlan, rotation: 0 },
  },
  {
    id: 'book-research', posture: 'book', mood: 'book', enter: 'cut', turn: true,
    shot: { azimuth: 6, elevation: 12, fov: fov.wide - 2, fill: 0.62, at: [0.26, 0] },
    copy: { kicker: 'Book', headline: 'A note, and where it came from.', place: 'left' },
    outer: off, inner: { view: views.noteSource, rotation: 0 },
  },
  {
    id: 'seated-kitchen', posture: 'seated', mood: 'evening', enter: 'cut',
    shot: { azimuth: 20, elevation: 34, fov: fov.wide, fill: 0.58, at: [0.3, 0] },
    copy: { kicker: 'Seated', headline: 'A station, not a screen.', body: 'The recipe up top. The kitchen within reach.', place: 'left' },
    outer: off, inner: { view: views.kitchen, rotation: 90 },
  },
  {
    id: 'open-review', posture: 'open', mood: 'dusk', enter: 'device',
    shot: { azimuth: -10, elevation: 8, fov: fov.default, fill: 0.52, at: [0.22, 0.04] },
    copy: { kicker: 'Open', headline: 'A short review, then rest.', body: 'Tomorrow’s first block is already set.', place: 'left' },
    outer: off, inner: { view: views.review, rotation: 0 },
  },
  {
    id: 'standing-night', posture: 'standing', mood: 'night', enter: 'device',
    shot: { azimuth: -24, elevation: 5, fov: fov.wide - 2, fill: 0.56, at: [0.34, -0.06] },
    copy: { headline: 'Quiet.', place: 'left', hero: true },
    outer: { view: () => views.bedside('night', '11:48'), rotation: 270 }, inner: off,
  },
];
