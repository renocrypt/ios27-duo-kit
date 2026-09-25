/**
 * The hub's screens for "a day with Duo" (docs/hub.md, docs/presentation.md):
 * HTML templates for ScreenSurface, at the display's point size in the posture's orientation, laid
 * out on iPhone Duo's own system UI (docs/duo-ui.md).
 *
 *   views.lockNowNext()   -> { html, appearance }   appearance: 0 dark content, 1 light (for the glass)
 *
 * Views hold the hub's content; Duo's system chrome (the rail, the top bar, sheets, the island, the
 * status) comes from chrome.ts, so every screen follows the same kit numbers.
 *
 * Outer display: 466 x 678 pt portrait (678 x 466 in Standing), camera at the top of the rail.
 * Inner display: 951 x 669 pt landscape (669 x 951 in Seated); the fold is the band at the centre.
 *
 * Copy and artwork are ours; people and places are fictional.
 */
import { icon, type IconName } from '../kit/icons.ts';
import { glass, island, paneButton, rail, searchField, sheet, topbar } from '../kit/chrome.ts';
import './views.css';

export interface View { html: string; appearance: number }

// ---- Outer display ------------------------------------------------------------------------------

/** Title: the outer display wakes to the time on black (the Lock Screen at rest). */
function titleFace(): View {
  return { appearance: 0, html: `
  <div class="scr outer lock lock--rest">
    <div class="lock-date">Thursday, September 24</div>
    <div class="lock-time">6:41</div>
    ${rail({ display: 'outer' })}
  </div>` };
}

/** Standing, bedside (StandBy, full screen): a red clock at night; at dawn, colour returns with the overnight result. */
function bedside(mode: 'night' | 'dawn', time: string): View {
  const note = mode === 'dawn'
    ? `<div class="bedside-note" data-glass="regular" data-glass-flip="false">${icon('sparkles')}<div><b>Your Q3 summary is ready</b><span>Finished overnight · 6 pages</span></div></div>`
    : '';
  return { appearance: 0, html: `<div class="scr bedside bedside--${mode}"><div class="bedside-date">Thu 24</div><div class="bedside-time">${time}</div>${note}</div>` };
}

/** Closed, first pickup: the Lock Screen with what is held, and one message worth a glance. */
function lockNowNext(): View {
  return { appearance: 1, html: `
  <div class="scr outer lock wall-dawn">
    <div class="lock-date">Thursday, September 24</div>
    <div class="lock-time">7:15</div>
    <div class="notif" data-glass="regular">
      <div class="notif-head">${icon('sparkles')}<span>Held for you</span><em>7 · next digest 9:00</em></div>
      <div class="notif-msg"><div class="avatar">M</div>
        <div><b>Maya</b><span>Landing at 10:40, Terminal 5. Can you grab me?</span></div></div>
      <div class="notif-actions"><span class="chip is-primary">${icon('reply')}Reply</span><span class="chip">${icon('clock')}Later</span></div>
    </div>
    ${rail({ display: 'outer', bottom: [{ round: 'flashlight' }, { round: 'camera' }] })}
  </div>` };
}

/**
 * Closed, midday: the agent's booking as a Live Activity grown from the camera, and a side-button
 * approval in a sheet at its medium detent. The kit's outer sheet: 8 pt from the edges, corners
 * concentric with the display, a grabber, the title leading and a close button trailing. While the
 * system waits for the side button, its prompt takes the rail beside the button, so the status
 * steps aside [C].
 */
function liveApproval(): View {
  return { appearance: 1, html: `
  <div class="scr outer wall-noon">
    ${sheet({ title: 'Apple Pay', close: true }, `
      <div class="sheet-merchant">${icon('fork')}</div>
      <h3>Hold a table for 4</h3>
      <p>Osteria Mozza · Tonight at 7:00 PM</p>
      <div class="sheet-amount">$60.00</div>
      <p>Deposit, refunded at the table</p>
      <div class="sheet-rule"></div>
      <div class="sheet-row"><span>Booked by</span><b>${icon('sparkles')}Your agent</b></div>
      <div class="sheet-row"><span>Card</span><b>Visa ·· 4417</b></div>`)}
    ${rail({ display: 'outer', status: false, island: island('sparkles', 0.72, '#7D6BF2') })}
    <div class="side-cue"><span>Press to<br>approve</span><i></i></div>
  </div>` };
}

// ---- Inner display, landscape --------------------------------------------------------------------

const events: [string, string, string, string, string?][] = [
  ['9:00', 'var(--color-system-purple)', 'Standup', 'Zoom · 15 min'],
  ['10:40', 'var(--color-system-orange)', 'Pick up Maya', 'LAX, Terminal 5 · leave by 10:05', 'is-changed'],
  ['12:30', 'var(--color-system-green)', 'Lunch with Sam', 'Gjelina, Abbot Kinney'],
  ['2:00', 'var(--color-system-blue)', 'Focus: Q4 plan', 'Two hours, notifications held', 'is-changed'],
  ['4:30', 'var(--color-system-pink)', 'Design review', 'Studio B'],
  ['7:00', 'var(--color-system-red)', 'Dinner for 4', 'No table yet', 'is-flag'],
];

/** Open flat, morning: today in the sidebar, the agent's proposed plan in the detail pane. */
function todayPlan(): View {
  const rows = events.map(([t, c, title, where, cls]) =>
    `<div class="tl-row ${cls ?? ''}"><div class="tl-time">${t}</div><div class="tl-bar" style="background:${c}"></div><div><div class="tl-title">${title}</div><div class="tl-where">${where}</div></div></div>`).join('');
  const change = (bg: string, ic: IconName, title: string, why: string) =>
    `<div class="change"><div class="change-icon" style="background:${bg}">${icon(ic)}</div><div><b>${title}</b><span>${why}</span></div></div>`;
  return { appearance: 1, html: `
  <div class="scr inner app app-light">
    <div class="side">
      <div class="side-head">${paneButton('sidebar')}<div class="spacer"></div>${paneButton('plus')}</div>
      <div class="side-title"><div class="eyebrow">Thursday, September 24</div><div class="title-lg">Today</div></div>
      <div class="tl">${rows}</div>
      ${searchField()}
    </div>
    <div class="detail">
      <div class="proposal">
        <div class="proposal-head">${icon('sparkles')}<span>From your agent</span><em>7:12 AM</em></div>
        <div class="proposal-title">Three changes to today</div>
        ${change('var(--color-system-orange)', 'car', 'Leave for LAX at 10:05', 'Traffic on the 405 adds 18 minutes.')}
        ${change('var(--color-system-blue)', 'clock', 'Move Focus to 1:30–3:30', 'Keeps two hours unbroken after lunch.')}
        ${change('var(--color-system-red)', 'fork', 'Book dinner for 4 at 7:00', 'Osteria Mozza holds a table until 2 PM.')}
        <div class="proposal-actions">
          <div class="btn" ${glass()}>Change</div>
          <div class="btn" ${glass({ color: '#0A84FF' })}>Approve</div>
        </div>
        <div class="proposal-foot">Nothing changes until you approve.</div>
      </div>
      <div class="minis">
        <div class="mini"><span class="mini-icon" style="color:var(--color-system-orange)">${icon('sun')}</span><div><b>72° and clear</b><span>Santa Monica, all day</span></div></div>
        <div class="mini"><span class="mini-icon" style="color:var(--color-system-indigo)">${icon('bell')}</span><div><b>7 held</b><span>Next digest at 9:00</span></div></div>
      </div>
    </div>
    ${rail({ display: 'inner', time: '7:18', top: [{ group: ['share', 'ellipsis'] }], bottom: [{ tabs: ['sun', 'sparkles', 'book'], selected: 0, search: true }] })}
  </div>` };
}

/** Book, afternoon: a note and the passage it came from, one on each side of the crease. */
function noteSource(): View {
  return { appearance: 1, html: `
  <div class="scr inner app app-light book">
    <div class="half half--l note">
      <div class="side-head">${paneButton('sidebar')}<div class="side-head-title"><b>Memory</b><span>Tidal energy</span></div><div class="spacer"></div>${paneButton('ellipsis')}</div>
      <div class="note-title">Why tidal power stalls</div>
      <div class="note-meta">${icon('sparkles')}<span>Today, 3:40 PM · 2 sources</span></div>
      <div class="note-body">
        <p>The resource is predictable to the minute, which is rare for renewables. The problem is the water itself.</p>
        <p><mark>Seawater fouls and corrodes turbines so fast that maintenance, not construction, sets the price of each kilowatt-hour.</mark><span class="cite">1</span></p>
        <p>Worth asking Sam: does the new coating data change the math?</p>
        <div class="note-list-title">To check</div>
        <ul class="note-list"><li>Coating results from the Orkney trial, 2025</li><li>Maintenance intervals before and after</li><li>Cost per kilowatt-hour, onshore wind as the baseline</li></ul>
      </div>
    </div>
    <div class="half half--r source">
      <div class="src-site"><span class="src-logo">H</span>Harbor Review<em>harborreview.org</em></div>
      <div class="src-title">The quiet math of tidal turbines</div>
      <div class="src-by">By Lena Ortiz · 12 min read</div>
      <div class="src-body">
        <p>Engineers like to say the tide is the one renewable you can schedule. Every high water is known years in advance, and the rotors spin whether or not the wind blows.</p>
        <p><mark>Yet seawater fouls and corrodes the machinery so quickly that maintenance, rather than construction, ends up setting the cost of every kilowatt-hour</mark> a site delivers.</p>
        <p>New coatings promise to double the time between overhauls. If they hold up in open water, the arithmetic changes.</p>
        <blockquote class="pull">“We can predict the tide for a century. We can’t predict the barnacles.”</blockquote>
      </div>
    </div>
    ${rail({ display: 'inner', time: '3:41', top: [{ round: 'chevronLeft' }, { group: ['share', 'ellipsis'] }], bottom: [{ group: ['highlighter', 'link'] }, { round: 'compose' }] })}
  </div>` };
}

/** Open flat, night: the day reviewed with the agent's ledger, and tomorrow's first block. */
function review(): View {
  const row = (ic: IconName, color: string, title: string, detail: string, when = '') =>
    `<div class="row"><span style="color:${color}">${icon(ic)}</span><div><b>${title}</b><span>${detail}</span></div><em>${when}</em></div>`;
  return { appearance: 0, html: `
  <div class="scr inner app app-dark review wall-dusk">
    <div class="side">
      <div class="side-head">${paneButton('sidebar')}<div class="spacer"></div>${paneButton('ellipsis')}</div>
      <div class="side-title"><div class="eyebrow">Thursday, September 24</div><div class="title-lg">Today, reviewed</div></div>
      <div class="group">
        ${row('checkCircle', '#30D158', 'Picked up Maya', 'Left at 10:05, home by 11:40', '10:52 AM')}
        ${row('checkCircle', '#30D158', 'Focus: Q4 plan', 'Two hours, nothing broke through', '3:30 PM')}
      </div>
      <div class="eyebrow group-label">Agent ledger · 3 actions</div>
      <div class="group">
        ${row('sparkles', '#BF5AF2', 'Held a table at Osteria Mozza', '$60 deposit, approved with the side button', '1:02 PM')}
        ${row('sparkles', '#BF5AF2', 'Moved your Focus block', 'Approved on the open display', '7:18 AM')}
        ${row('sparkles', '#BF5AF2', 'Summarized Q3 overnight', 'Read at breakfast', '6:58 AM')}
      </div>
    </div>
    <div class="detail">
      <div class="eyebrow">Tomorrow</div>
      <div class="tomorrow-card">
        <div class="eyebrow">8:30 AM</div>
        <b>Deep work: Q4 plan</b>
        <span>Two hours on the calendar, notifications held</span>
        <div class="badge">${icon('check')}Set</div>
      </div>
      <div class="tmrw">
        <div class="tmrw-row"><span>10:00</span><i style="background:var(--color-system-pink)"></i><b>Design sync</b></div>
        <div class="tmrw-row"><span>12:30</span><i style="background:var(--color-system-green)"></i><b>Lunch with Maya</b></div>
        <div class="tmrw-row"><span>4:00</span><i style="background:var(--color-system-teal)"></i><b>Dentist</b></div>
      </div>
      <div class="quiet">${icon('moon')}<span>Wind down at 10:30 · Sleep until 6:45</span>
        <div class="btn btn--quiet" ${glass({ color: '#5E5CE6' })}>Good night</div></div>
    </div>
    ${rail({ display: 'inner', time: '9:28', top: [{ group: ['share', 'ellipsis'] }], bottom: [{ tabs: ['sun', 'sparkles', 'book'], selected: 1, search: true }] })}
  </div>` };
}

// ---- Inner display, portrait (Seated) -------------------------------------------------------------

/**
 * Seated, evening: the inner display in portrait keeps horizontal bars (the kit's top bar: title,
 * glass groups, the horizontal status). The recipe fills the raised half; the kitchen's controls sit
 * on the lower half, near the base.
 */
function kitchen(): View {
  const r = 96, c = 2 * Math.PI * r, done = 0.64;
  return { appearance: 0, html: `
  <div class="scr kitchen wall-evening">
    ${topbar('Lemon ricotta pasta', [{ group: ['list', 'timer'] }], '6:52')}
    <div class="k-top">
      <div class="k-recipe">
        <div class="k-step-label">${icon('flame')}<span>Step 3 of 6</span></div>
        <div class="k-step">Toss the pasta with ricotta, lemon zest, and a splash of the cooking water.</div>
        <div class="k-dots"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i><i></i></div>
        <div class="k-ingredients"><span>Ricotta · 250 g</span><span>Lemon · zest of 1</span><span>Pasta water · ½ cup</span></div>
        <div class="k-next"><span>Next</span>Season, then finish with black pepper and oil.</div>
      </div>
      <div class="k-source">${icon('book')}<span>From Memory · Mom's recipe card</span></div>
    </div>
    <div class="k-bottom">
      <div class="k-grid">
        <div class="k-tile k-timer">
          <div class="k-ring">
            <svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="${r}" fill="none" stroke="#FFFFFF26" stroke-width="12"/>
              <circle cx="110" cy="110" r="${r}" fill="none" stroke="#FFB86B" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${c * done} ${c}" transform="rotate(-90 110 110)"/></svg>
            <div class="k-ring-read"><b>7:42</b><span>Pasta water</span></div>
          </div>
          <div class="k-timer-actions"><div class="btn" data-glass="regular" data-glass-flip="false">+1 min</div><div class="rb" data-glass="regular" data-glass-flip="false">${icon('pause', { fill: true })}</div></div>
        </div>
        <div class="k-tile">
          <div class="k-tile-label">${icon('bulb')}<span>Kitchen</span></div>
          <div class="k-big">80%</div>
          <div class="k-slider"><i></i><b data-glass="regular" data-glass-flip="false"></b></div>
        </div>
        <div class="k-tile">
          <div class="k-tile-label">${icon('music')}<span>Now playing</span></div>
          <div class="k-track">Take Five</div>
          <div class="k-artist">The Dave Brubeck Quartet</div>
          <div class="rb k-play" data-glass="regular" data-glass-flip="false">${icon('play', { fill: true })}</div>
        </div>
      </div>
    </div>
  </div>` };
}

/** A display that is off. */
function off(): View { return { appearance: 0, html: '<div class="scr" style="background:#000"></div>' }; }

export const views = { titleFace, bedside, lockNowNext, liveApproval, todayPlan, noteSource, kitchen, review, off };
