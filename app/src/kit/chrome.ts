/**
 * Duo's system chrome, the parts every app screen is built from, to the numbers of Apple's iOS 27
 * UI Kit (docs/duo-ui.md section 2). Views describe what they need; this
 * module decides how Duo lays it out. HTML strings for ScreenSurface; glass is marked, the
 * compositor draws it.
 *
 *   rail({ display: 'inner', time: '7:18', top: [{ group: ['share', 'ellipsis'] }],
 *          bottom: [{ tabs: ['sun', 'book'], selected: 0, search: true }] })
 *                          the Vertical Bar on the trailing edge (outer display; inner in landscape)
 *   topbar(title, [{ group: [...] }], '6:52')
 *                          the inner display's top bar in portrait (Seated)
 *   sheet({ title: 'Apple Pay', close: true }, body)
 *                          an outer-display sheet at its medium detent
 *   island('sparkles', 0.72, '#7D6BF2')
 *                          a Live Activity grown from the outer camera (pass as rail({ island }))
 *   paneButton('sidebar'), searchField()
 *                          content-local controls: a pane's own header buttons and search field
 *   glass(tint?)           the attributes that make any element a Liquid Glass shape
 *
 * Controls, as data:
 *   { round: 'xmark' }                           a single 48 pt glass button
 *   { group: ['share', 'ellipsis'] }             buttons sharing one glass capsule (vertical in the
 *                                                rail, horizontal in a top bar)
 *   { tabs: ['sun', 'book'], selected: 0, search: true }   the vertical tab bar, and search below it
 */
import { icon, type IconName } from './icons.ts';
import { statusBar, type Levels } from './status.ts';
import './chrome.css';

export type Tint = { color: string; strength?: number };
export type Control =
  | { round: IconName; tint?: Tint; fill?: boolean; ink?: string }
  | { group: IconName[] }
  | { tabs: IconName[]; selected: number; search?: boolean };

let glassId = 0;
/** Attributes that make an element a glass shape; its box and border radius become the shape. */
export const glass = (tint?: Tint) =>
  `data-glass="regular" data-glass-id="g${glassId++}"${tint ? ` data-glass-tint="${tint.color}" data-glass-tint-strength="${tint.strength ?? 1}"` : ''}`;

function control(c: Control, direction: 'v' | 'h' = 'v'): string {
  if ('round' in c) return `<div class="rb" ${glass(c.tint)}${c.ink ? ` style="color:${c.ink}"` : ''}>${icon(c.round, { fill: c.fill })}</div>`;
  if ('group' in c) return `<div class="rg${direction === 'h' ? ' rg--h' : ''}" ${glass()}>${c.group.map((n) => `<span class="rg-item">${icon(n, { fill: n === 'ellipsis' })}</span>`).join('')}</div>`;
  const tabs = c.tabs.map((n, i) => `<span class="rt-tab${i === c.selected ? ' is-selected' : ''}">${icon(n, { fill: i === c.selected, weight: 'semibold' })}</span>`).join('');
  return `<div class="rt"><div class="rt-tabs" ${glass()}>${tabs}</div>${c.search ? `<div class="rb" ${glass()}>${icon('search', { weight: 'semibold' })}</div>` : ''}</div>`;
}

/** The status; without a time it keeps its place (the Lock Screen shows the time large instead). */
function status(layout: 'vertical' | 'horizontal', time?: string, levels: Levels = {}): string {
  const html = statusBar({ layout, time: time ?? '9:41', ...levels });
  return time ? html : html.replace('class="duo-status ', 'class="duo-status is-timeless ');
}

export interface RailOptions {
  display: 'outer' | 'inner';
  /** The time in the status; omitted, the status keeps its place without it. */
  time?: string;
  /** Show the status. Default true; false when a system prompt takes the rail. */
  status?: boolean;
  levels?: Levels;
  /** Outer display: a Live Activity grown from the camera (island()). */
  island?: string;
  top?: Control[];
  bottom?: Control[];
}

export function rail(o: RailOptions): string {
  const camera = o.display === 'outer'
    ? `<div class="rail-punch${o.island ? ' has-island' : ''}">${o.island ?? '<div class="rail-lens"></div>'}</div>` : '';
  const top = [o.status === false ? '' : status('vertical', o.time, o.levels), ...(o.top ?? []).map((c) => control(c))].join('');
  return `<div class="rail rail--${o.display}">
    <div class="rail-top">${camera}<div class="rail-stack">${top}</div></div>
    <div class="rail-stack">${(o.bottom ?? []).map((c) => control(c)).join('')}</div>
  </div>`;
}

export function topbar(title: string, trailing: Control[], time: string, levels: Levels = {}): string {
  return `<div class="topbar"><div class="topbar-title type-headline">${title}</div>
    <div class="topbar-trailing">${trailing.map((c) => control(c, 'h')).join('')}${status('horizontal', time, levels)}</div></div>`;
}

export function island(glyph: IconName, progress: number, tint: string): string {
  const r = 12, c = 2 * Math.PI * r;
  return `<div class="island">
    <div class="island-camera"></div>
    <div class="island-glyph" style="background:${tint}">${icon(glyph, { fill: true })}</div>
    <svg class="island-progress" viewBox="0 0 30 30"><circle cx="15" cy="15" r="${r}" fill="none" stroke="#FFFFFF33" stroke-width="3"/>
      <circle cx="15" cy="15" r="${r}" fill="none" stroke="${tint}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(c * progress).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 15 15)"/></svg>
  </div>`;
}

export function sheet(o: { title: string; close?: boolean; className?: string }, body: string): string {
  return `<div class="sheet ${o.className ?? ''}" data-glass="regular">
    <div class="sheet-grabber"></div>
    <div class="sheet-bar"><span class="type-headline">${o.title}</span>${o.close ? `<div class="rb sheet-close" ${glass()}>${icon('xmark')}</div>` : ''}</div>
    ${body}
  </div>`;
}

export const paneButton = (name: IconName) => `<div class="pb" ${glass()}>${icon(name, { fill: name === 'ellipsis' })}</div>`;
export const searchField = (placeholder = 'Search') => `<div class="search-field" ${glass()}>${icon('search')}<span>${placeholder}</span>${icon('mic')}</div>`;
