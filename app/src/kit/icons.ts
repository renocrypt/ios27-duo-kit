/**
 * Our own icon set for the device interfaces, drawn in the manner of SF Symbols (Apple's symbols
 * are not ours to copy): round caps and joins, rounded corners, one stroke weight per text weight.
 *
 * Metrics. The 24-unit box is 24 pt when the icon stands for a 17 pt symbol, so a glyph's extent
 * in units is its size in points at 17 pt: set `font-size: 24px` for a 17 pt symbol, and scale
 * from there (18 pt: 25.4px). The rail's glyphs (chevrons, xmark, ellipsis, magnifying glass,
 * square and pencil, square and arrow, sidebar, trash, folder, reply arrow, plus) are drawn to the
 * extents SF Symbols has at 17 pt, as measured on Apple's Mail figures
 * (docs/duo-ui.md section 2).
 *
 * Weight. Stroke widths follow SF Pro's stems at 17 pt (measured in Chrome: Regular 1.50,
 * Medium 1.83, Semibold 2.15 pt), about 90% of them, as symbols run slightly lighter than text:
 * `weight: 'regular' | 'medium' | 'semibold'` (default medium). The kit sets toolbar symbols in
 * Medium 17, tab symbols in Semibold 18, search in Semibold 17.
 *
 *   icon('sparkles')                              -> '<svg ...>' sized 1em, coloured by currentColor
 *   icon('trash', { weight: 'medium' })
 *   icon('play', { fill: true })
 */

const P: Record<string, string> = {
  sparkles: 'M10 3.5 11.6 8.4 16.5 10 11.6 11.6 10 16.5 8.4 11.6 3.5 10 8.4 8.4ZM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8ZM17.5 3l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4L15.5 5l1.4-.6Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.2l3.4 2',
  calendar: 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v11.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5ZM3.5 10h17M8 3.5v4M16 3.5v4',
  check: 'M5 12.5 9.5 17 19 7.5',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.3l2.7 2.7L16.2 9.5',
  xmark: 'M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7',
  reply: 'M9.6 4.7 2.9 10.5l6.7 5.9v-3.7h3.2c3.8 0 6.5 1.6 8.4 5.6 0-6.6-3.3-10.2-8.4-10.2H9.6Z',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15ZM10 20.5a2 2 0 0 0 4 0',
  car: 'M5 16.5V12l1.8-4.6A2 2 0 0 1 8.7 6h6.6a2 2 0 0 1 1.9 1.4L19 12v4.5M5 12h14M5 16.5h14M6.5 16.5v2M17.5 16.5v2M8 14.3h.01M16 14.3h.01',
  fork: 'M7 3.5v6a2.5 2.5 0 0 0 5 0v-6M9.5 3.5v17M16.5 20.5V3.5c-1.8 1-3 3.3-3 6.2V13h3',
  doc: 'M7 3.5h6.5l4.5 4.5v11A1.5 1.5 0 0 1 16.5 20.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5ZM13.5 3.5V8H18M9 12.5h6M9 16h6',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1',
  book: 'M4 5.5c2.7-.9 5.4-.7 8 1.2 2.6-1.9 5.3-2.1 8-1.2v13c-2.7-.9-5.4-.7-8 1.2-2.6-1.9-5.3-2.1-8-1.2ZM12 6.7v13',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5M9.5 2.5h5M18.5 5.5l1.5-1.5',
  bulb: 'M9 17.5h6M10 20.5h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1v1.5h5V16c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  flame: 'M12 21c3.6 0 6-2.5 6-5.8 0-3.7-3-5.6-3.7-9.2-2.1 1.6-3 3.6-3 5.3-1-.6-1.6-1.8-1.7-3C7.5 10 6 12.2 6 15.2 6 18.5 8.4 21 12 21Z',
  lock: 'M7 10.5V8a5 5 0 0 1 10 0v2.5M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5Z',
  flashlight: 'M8.5 3.5h7l-1 5v11.5a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V8.5ZM9 8.5h6M12 12v2.5',
  camera: 'M4.5 8h3l1.5-2.5h6L16.5 8h3A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8ZM12 16.5a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z',
  chevronRight: 'M8.8 4.2 16.1 12l-7.3 7.8',
  chevronLeft: 'M15.2 4.2 7.9 12l7.3 7.8',
  plus: 'M12 5.2v13.6M5.2 12h13.6',
  search: 'M10.3 16.6a6.3 6.3 0 1 0 0-12.6 6.3 6.3 0 0 0 0 12.6ZM14.9 14.9l4.4 4.4',
  compose: 'M11.4 5.6H7.2a3.4 3.4 0 0 0-3.4 3.4v9.6a3.4 3.4 0 0 0 3.4 3.4h9.6a3.4 3.4 0 0 0 3.4-3.4v-4.3M18.4 3.2a1.6 1.6 0 0 1 2.3 0l.2.2a1.6 1.6 0 0 1 0 2.3l-8.4 8.4-3.3 1 1-3.3Z',
  sidebar: 'M5.6 4.1h12.8a3.4 3.4 0 0 1 3.4 3.4v9a3.4 3.4 0 0 1-3.4 3.4H5.6a3.4 3.4 0 0 1-3.4-3.4v-9a3.4 3.4 0 0 1 3.4-3.4ZM9.2 4.1v15.8M4.9 8.2h1.7M4.9 10.9h1.7M4.9 13.6h1.7',
  ellipsis: 'M5 12h.01M12 12h.01M19 12h.01',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUpRight: 'M7 17 17 7M9 7h8v8',
  shield: 'M12 3.5 5 6v5.5c0 4.3 2.9 7.8 7 9 4.1-1.2 7-4.7 7-9V6Z',
  bolt: 'M13.5 3 5 13.5h6.5L10.5 21 19 10.5h-6.5Z',
  plane: 'M3.5 13.5 10 12l-3-7.5h2.2l5.3 7.2 4.4-1c1.3-.3 2.6.6 2.6 1.9 0 .9-.6 1.6-1.4 1.8l-5.6 1.4-3.5 6.2H8.8l1.4-5.5-5.7 1.2Z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  quote: 'M5 17c2.5-1 4-3 4-6V7H4.5v5H8M14 17c2.5-1 4-3 4-6V7h-4.5v5H17',
  highlighter: 'M14.5 4.5l5 5-8 8H7.5l-3-3v-2ZM4.5 20.5h15',
  share: 'M12 15V2.9M8.1 6.7 12 2.8l3.9 3.9M8.6 9.6H8.2a3 3 0 0 0-3 3v5.6a3 3 0 0 0 3 3h7.6a3 3 0 0 0 3-3v-5.6a3 3 0 0 0-3-3h-.4',
  list: 'M4.4 6.5h.4M4.4 12h.4M4.4 17.5h.4M9 6.5h11M9 12h11M9 17.5h11',
  chevronUp: 'M4.4 15.8 12 8.2l7.6 7.6',
  chevronDown: 'M4.4 8.2 12 15.8l7.6-7.6',
  trash: 'M4.2 6.3h15.6M9 6.3V4.9a1.4 1.4 0 0 1 1.4-1.4h3.2A1.4 1.4 0 0 1 15 4.9v1.4M5.9 6.3l1 12.9a2 2 0 0 0 2 1.8h6.2a2 2 0 0 0 2-1.8l1-12.9',
  folder: 'M2.8 7.3v10.3a2.6 2.6 0 0 0 2.6 2.6h13.2a2.6 2.6 0 0 0 2.6-2.6V10a2.6 2.6 0 0 0-2.6-2.6h-7.2L9.7 5.4a2 2 0 0 0-1.5-.7H5.4a2.6 2.6 0 0 0-2.6 2.6ZM2.8 10h18.4',
  mic: 'M12 14.5a3 3 0 0 0 3-3v-5a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3ZM6.5 11a5.5 5.5 0 0 0 11 0M12 16.5v4',
};

// Filled glyphs (drawn as shapes).
const F: Record<string, string> = {
  play: 'M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.8-6.8a.8.8 0 0 0 0-1.4L9.2 4.5a.8.8 0 0 0-1.2.7Z',
  pause: 'M7 4.5h3.2v15H7ZM13.8 4.5H17v15h-3.2Z',
  forward: 'M3.5 6.2v11.6a.7.7 0 0 0 1.1.6L12 13.3v4.5a.7.7 0 0 0 1.1.6l8.6-5.8a.7.7 0 0 0 0-1.2L13.1 5.6a.7.7 0 0 0-1.1.6v4.5L4.6 5.6a.7.7 0 0 0-1.1.6Z',
  dot: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  ellipsis: 'M5 13.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM12 13.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM19 13.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z',
  sparkles: P.sparkles,
  moon: P.moon,
  bolt: P.bolt,
};

/** Touch ID: concentric arcs of a fingerprint, our own drawing. */
const TOUCH_ID = `<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
  <path d="M7.5 4.2A9 9 0 0 1 20.5 11"/><path d="M4.4 7.8A9 9 0 0 0 3.2 12.5"/><path d="M16.8 20.3A9 9 0 0 1 12 21.5"/>
  <path d="M6.2 16.8a7 7 0 0 1-.7-4.3A6.5 6.5 0 0 1 18.4 12c0 1.4-.1 2.8-.5 4.1"/><path d="M8.6 19.4c1-1.9 1.4-4.2 1.4-6.9a2 2 0 0 1 4 0c0 3-.5 5.7-1.6 8"/>
  <path d="M12 12.5c0 3.3-.8 6.1-2.2 8.3"/><path d="M8 13c0-2.5 1.8-4.4 4-4.4 2.2 0 4 1.9 4 4.4 0 1-.1 2-.2 2.9"/></g>`;

export type IconName = keyof typeof P | keyof typeof F | 'touchId';

/** Stroke width, in units, per weight (see the header: about 90% of SF Pro's stem). */
export const WEIGHT = { regular: 1.4, medium: 1.65, semibold: 1.95 } as const;
export type Weight = keyof typeof WEIGHT;

export function icon(name: IconName, opts: { fill?: boolean; size?: number; weight?: Weight; className?: string } = {}): string {
  const size = opts.size ? `width="${opts.size}" height="${opts.size}"` : 'width="1em" height="1em"';
  const cls = `scr-icon ${opts.className ?? ''}`;
  if (name === 'touchId') return `<svg class="${cls}" ${size} viewBox="0 0 24 24" aria-hidden="true">${TOUCH_ID}</svg>`;
  if (opts.fill && F[name]) return `<svg class="${cls}" ${size} viewBox="0 0 24 24" aria-hidden="true"><path d="${F[name]}" fill="currentColor"/></svg>`;
  const d = P[name] ?? F[name];
  return `<svg class="${cls}" ${size} viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${WEIGHT[opts.weight ?? 'medium']}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
