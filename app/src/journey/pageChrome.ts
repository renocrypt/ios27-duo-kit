/**
 * The page's own chrome around the presentation: a small link to the source, and, where the
 * browser cannot draw the screens, a gentle note on how to see them. Both follow the scene's ink
 * (`body[data-ink]`, set by the journey).
 *
 *   sourcePill('https://github.com/renocrypt/ios27-duo-kit');
 *   if (!ScreenSurface.supported) screensNotice();
 */
import './pageChrome.css';

const FLAG = 'chrome://flags/#canvas-draw-element';
const DISMISSED = 'duo.screensNotice.dismissed';

/** A quiet "Source" pill in the bottom-left corner. */
export function sourcePill(href: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'pc-pill pc-source';
  a.href = href;
  a.rel = 'noopener';
  a.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Source';
  document.body.append(a);
  return a;
}

/**
 * The screens are drawn with Chrome's HTML-in-Canvas, still behind a flag (an origin trial, not
 * on by default as of September 2026). Without it the device renders with dark screens; this note
 * says how to see them, and stays dismissed once closed.
 */
export function screensNotice(): void {
  if (localStorage.getItem(DISMISSED)) return;
  const ua = navigator.userAgent;
  const chrome = /Chrome\/\d+/.test(ua) && !/Edg\/|OPR\//.test(ua);
  const note = document.createElement('aside');
  note.className = 'pc-pill pc-notice';
  note.setAttribute('role', 'note');
  note.innerHTML = chrome
    ? `<span>The screens need Chrome's HTML-in-Canvas. Turn on <code>${FLAG}</code>, then relaunch.</span>
       <button type="button" class="pc-copy">Copy</button><button type="button" class="pc-close" aria-label="Dismiss">×</button>`
    : `<span>The screens are drawn with HTML-in-Canvas, which only Chrome has for now, behind a flag. Open this page in Chrome to see them.</span>
       <button type="button" class="pc-close" aria-label="Dismiss">×</button>`;
  note.querySelector('.pc-copy')?.addEventListener('click', async (e) => {
    await navigator.clipboard.writeText(FLAG);
    (e.target as HTMLButtonElement).textContent = 'Copied';
  });
  note.querySelector('.pc-close')!.addEventListener('click', () => { localStorage.setItem(DISMISSED, '1'); note.remove(); });
  document.body.append(note);
  requestAnimationFrame(() => note.classList.add('is-on'));
}
