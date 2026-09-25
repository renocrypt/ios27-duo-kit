# iPhone Duo system UI: how Duo's interfaces differ from iPhone and iPad

September 23, 2026. This is the layout model our screens (`app/src/kit/` for the chrome, `app/src/hub/` for the screens) follow.

**Sources.** Each statement below carries one of these labels.

| Label | Source |
| --- | --- |
| [HIG] | Apple's *Designing for iPhone Duo* page (Sept 9, 2026) and its figures. |
| [DOC] | The *Preparing your app for iPhone Duo* article and the `ReservedRegion` / `ArrangementView` API references. |
| [TT] | Apple's Tech Talks: *Design for iPhone Duo* (111466), *Raise the bar with iPhone Duo* (111462), *Strike a pose with adaptive layouts* (111463). |
| [NR] | The Apple Newsroom announcement. |
| [R1] | A reference image supplied by the project owner: the inner display's Home Screen. |
| [R2] | A reference image supplied by the project owner: Mail on the outer display. |
| [R3] | A reference image supplied by the project owner: Mail in all six poses (Apple's "Six poses we have with iPhone Duo" slide). |
| [R4] | A reference image supplied by the project owner: the inner display in portrait, TV above Messages. |
| [KIT] | Apple's iOS 27 UI Kit (Sketch, public library "Apple iOS 27 UI Kit", linked from Apple Design Resources), read in the Sketch web viewer's Inspector: frame sizes, positions, stacks, type. Its "iPhone Duo" components: Status Bars / iPhone Duo (Vertical, Horizontal), Tab Bars / iPhone Duo / Vertical, Toolbars / Buttons / 48pt, Toolbars / iPhone Duo / Top, the Outer Display Lens, and Examples (Toolbar, Tab Bar, Sheet) for each display and orientation. |
| [M] | Our measurements from those images, in points, converted with the canvas sizes (inner 951 × 669 pt, outer 466 × 678 pt). Accurate to about ±2 pt. |
| [C] | Our own design choice, where Apple shows nothing. |

The raw material and images are kept in `/tmp/duo/duo-hig/` and `/tmp/duo/ios27-kit/`, not in this folder. The HIG and the developer docs publish no point dimensions for Duo's bars [HIG, DOC]; Apple's UI Kit does [KIT], and it is the source for section 2. Two frames of it, the vertical status in dark and light, were exported as vectors to `/tmp/duo/ios27-kit/` for the glyph lab (`app/labs/glyphs.html`); everything else was read in the Inspector. (Scripted bulk export from the kit is not allowed in this project's sessions; read numbers instead.)

## 1. The core pattern: controls on the side

> "toolbars, tab bars, and navigation controls that are typically at the top and bottom of the display move to the side … The exception is the inner display in portrait, which has enough vertical space to keep standard horizontal bars." [HIG]

**Where the rail appears.** On the outer display (in both orientations) and on the inner display in landscape, the system chrome and an app's bars form one vertical **rail** along the trailing edge. From top to bottom it holds [HIG figure "tab-bar-toolbar-layout"]:

1. **Dynamic Island.** On the outer display this is the camera: a plain circle at the top of the rail. It "expands into the Dynamic Island for Live Activities" [HIG]. The inner camera sits behind the display and occludes only while it is in use.
2. **Status bar.** The time (SF Pro Rounded Bold 16), then the status ring (46 pt): battery as the arc, Wi-Fi inside, cellular as four dots in the opening [KIT] (section 2).
3. **Toolbar.** Navigation comes first (Back or Close), then prominent Done-style actions, then groups. Each group is one glass shape: a single action is a round button, and related actions share a vertical capsule. The system spaces the groups; overflow folds bottom-to-top into the system's ellipsis menu [HIG].
4. **Tab bar.** A vertical capsule at the bottom of the rail. The selected tab sits on a lighter inner pill with a tinted glyph. Search is a separate round button below it.

**What moves off the rail.**
- Content-local controls may stay horizontal over their own pane: a sidebar's toggle and filter row, a search field at the foot of a list, a keyboard, a chat input bar [HIG figures, TT].
- Full-screen experiences skip the rail entirely: Calculator's 5 × 4 key grid, the camera, calls [HIG].
- "In general, don't override the default bar placement" [HIG].

**Multitasking.** Split View is 50/50, and each app keeps its rail on its own outer edge; nothing sits at the fold [HIG, TT].

## 2. Rail geometry [KIT]

The kit's Examples lay the rail out the same way on both displays; our tokens hold these numbers (`app/tokens/space.tokens.json`, `size.rail*`, `size.tab*`).

| | |
| --- | --- |
| The Vertical Bar | 84 wide on the trailing edge: 12 leading padding, a 48 column, 24 trailing. 24 from the top and the bottom. The column's centre is 48 from the trailing edge. Content ends at the bar (382 of 466 on the outer display). |
| Top section | The camera punchout (43 x 42; outer display only), 6, then a stack: the status, then the toolbar groups, 12 apart. |
| Outer Display Lens | 37 pt, #080808, centred at (417.8, 47.8) on the 466 x 678 outer display; the kit draws it in every outer frame. |
| Status (vertical) | 48 x 86: 11 above the time, the time (19 tall), 5, the ring (46 x 46), 5 below. |
| Status (horizontal) | 104 x 48: the time right-aligned in a 46-wide box at (8, 15), the ring at (57, 1). Used in the inner display's portrait top bar. |
| Time | SF Pro Rounded Bold 16 on a 19 pt line. Centred (vertical), right-aligned (horizontal). |
| Toolbar button | "Symbol 1": a 48 x 48 glass circle. Symbols: SF Pro Medium 17. |
| Toolbar group | "Vertical Group - Symbol 2 / 3": 48 x 110 / 164; 10 at each end, 36 x 36 buttons, 18 apart (a 54 pitch). Horizontal groups are the same turned (110 / 164 x 48). |
| Tab bar | A capsule 48 wide: 6 at each end, tabs 48 x 54, 2 apart (n tabs: 10 + 56 n). The selected tab sits on a 44 x 64 pill (Secondary Fill) centred on it, its symbol in blue. Tab symbols: SF Pro Semibold 18, no labels. |
| Search | A separate 48 x 48 glass circle, 8 below the tab bar; SF Pro Semibold 17. |
| Top bar (inner, portrait) | 82 tall: the title (SF Pro Semibold 17) at (20, 37); trailing actions 24 from the top and trailing edges, 12 apart: glass groups, then the horizontal status. |
| Sheet (outer) | 8 from the edges, corners 40 (top), 48 (trailing bottom) and 8 (hinge-side bottom), concentric with the display. A 60 x 4 grabber at 10; the title leading at (16, 27); trailing actions (e.g. close) at the top right. The sheet carries its own Vertical Bar with a camera punchout and status for when it reaches the top. |
| Glass buttons | Large 83 x 46 (Glass) / 83 x 50 (Glass Prominent); Regular 67 x 34; Small 59 x 28. |

**The status indicator** [KIT] is one glyph, not three: the ring's arc is the **battery** charge (outer radius 20.5, stroke 3.1, round caps 30.8 degrees below the horizontal, so it spans 241.6 degrees over the top); **Wi-Fi** sits inside it (a wedge and two bands, 18 x 13.3 at (14, 16)); **cellular** strength is four dots of radius 2 in the ring's opening, at 60, 80, 100 and 120 degrees. The kit draws only the full state; how lower levels look is ours [C] (`app/src/kit/status.ts`). Our drawing is fitted to the kit's vectors in `app/labs/glyphs.html`: every part within 0.02 pt, the time exact.

Earlier measurements from the HIG figures and [R2] ([M], about 2 pt accurate) are superseded by these; they agree within that error except the group pitch, which in Apple's Mail figures looks tighter (about 44 for the up/down pair) than the kit's 54.

## 3. The inner display and the fold

- **Reserved regions.** There are three [HIG, DOC]:
  - the outer camera (occlusion, always present);
  - the inner camera (occlusion, only while in use; at about 70% of the width and 8% of the height [HIG figure "device-layout-inner"]);
  - the folding region (division, only while partially folded). The fold excludes a band at the centre, about 27 pt in Apple's diagram (not a published value).
- **Split views follow the pose** [HIG figures Mail and Notes, TT].
  - Flat: the leading pane is content-sized, ≈ 34% of the width (320 pt) [M].
  - Partially folded (Book): the panes snap to 50/50 at the crease.
  - The leading pane carries its own horizontal header (sidebar toggle, title, a filter or More capsule) and a search field at its foot. The detail pane runs to the rail.
- **Fold avoidance.** Once folded, sheets, popovers, alerts and context menus dock within one pane and never straddle the crease. Scrolling content is exempt [HIG, TT].
- **Home Screen** [R1]: 8 columns with the crease between columns 4 and 5, so no icon sits on the fold. Widgets are top-left. The rail holds the time, the ring, a vertical Dock (4 apps, a ≈ 71 pt platter) and search at the bottom. Page dots are centred at the bottom. On the outer display the Home Screen has 4 columns and the same rail.
- **Portrait (Seated).** Standard horizontal bars, "like a big iPhone" [HIG]: the status bar across the top, bars at the top and bottom. Apple's Seated guidance: interactive controls go to the lower half near the stable base, media and content go on the upper half, and nothing is exclusive to the pose [TT].

## 4. Poses [HIG, DOC, TT, R3, R4]

Apple illustrates six poses without naming them: closed, folded like a tent, open in a wide layout, partially folded, open in a tall layout, and folded like a laptop. Our names follow `app/src/scene/postures.ts`: Closed, Standing (tent), Open (wide), Book (partially folded), Seated (laptop).

Design with size classes, not per pose: compact width on the outer display, regular width on the inner display.

**Mail in the six poses** [R3]:
- **Closed (outer, portrait):** the rail with the camera, the time and status, Back, an up/down group, and at the foot trash, folder, reply, then compose.
- **Closed, sideways (outer, landscape):** the rail on the long trailing side with Back, up/down, reply, compose; the camera sits at its bottom end.
- **Open flat and Book (inner, landscape):** the sidebar (toggle, filter and More at its head, a filter row, the list, search at its foot) and the message; the rail holds the status, compose, reply, reply all, forward, trash, folder. In Book the panes split at the crease.
- **Open tall and Seated (inner, portrait):** horizontal bars. The top bar: the sidebar toggle leading; the up/down group and the horizontal status ("9:41" and the ring) trailing. A bottom toolbar: trash, folder, reply leading, compose trailing. Seated keeps the same bars; the bottom toolbar lands on the lower half, near the base.

**Portrait split** [R4]: two apps stacked, one above the other. The top app (TV, full screen) keeps its close button leading, a small glass group and the horizontal status trailing; the bottom app (Messages) is a pane with rounded top corners, its conversation list a narrow column of avatars with compose at its foot, the input bar at the bottom.

## 5. Liquid Glass as Duo shows it [R1, R2, NR, M]

Superseded on September 24 by measurements of iOS itself (`liquid-glass.md`, version 0.2, and `research/2026-09-24-glass-probe-ios27.0.md`). What follows is what Apple's images showed, kept for the record.

Measured in sRGB (0 to 255) and fitted with a calibration lab since removed.

- **Body.** The glass body is the blurred content lifted in display space: +23 over black ([R2]: the Back button reads 23, 23, 23) and +28 over a dark wallpaper ([R1]: the search button reads 85, 87, 125 over 57, 59, 94). The hue holds, and there is no blue cast or tint.
- **Rim.** The rim is one thin line at the silhouette (51 over black). The top is flat, with its curvature packed into the edge, so small controls are discs, not domes.
- **Frost.** (Contradicted by the glass probe on September 24: iOS blurs in two scales and spreads an edge over 27 pt; see `liquid-glass.md`, last section. Kept for the record.) Content under regular glass is softened, not erased: R1's wallpaper edge, 3–4 px wide outside the Dock, is 8–10 px wide under it (1.09 px/pt), a Gaussian σ of about 2–3.5 pt. Over busy or opposite-toned content the tone fill takes over (Apple's Newsroom renders: Slack's light capsule over a photo is near-opaque white; text under the Siri search button is unreadable).
- **Lensing.** (The glass probe measures a wider band: 8.5 pt on a 48 pt button, 16 pt on a 96 pt capsule; see `liquid-glass.md`.) The rim bends what is under it: R1's edge is displaced 4–6 pt at 4–6 pt inside the Dock's rim, and on 48 pt buttons content wraps over the outer 10–14 pt (Apple's Newsroom renders). This, not the blur, is what distinguishes Liquid Glass from frosted glass.
- **Shadow.** None is visible over dark content.
- **Glyphs.** They are white on dark glass and about 20 to 22 pt. On light content in the HIG figures, controls are near-white glass with a faint grey rim and a soft shadow; the selected tab sits on a lighter inner pill.

## 6. Our screens' decisions [C]

Apple shows no Duo Lock Screen, StandBy face or Live Activity. Ours follow the rail logic:

- **Lock Screen (outer).**
  - The big clock and the date go at the top of the content column.
  - The camera, time and ring stay in the rail. The time also shows in the rail, as on every screen.
  - Notifications go in the content column.
  - The Lock Screen's two quick actions (flashlight, camera) move into the foot of the rail as round buttons, where the iPhone has them in the bottom corners.
- **Live Activity (outer).** It grows from the camera down the rail as a black vertical island: the camera, the app's glyph and a progress ring. A tap would expand it into a sheet in the content column.
- **Seated (inner, portrait).** The kit's top bar: the recipe's title leading, a glass group (steps, timers) and the horizontal status trailing. No classic iPhone status bar (cellular bars, Wi-Fi, battery) anywhere on Duo.
- **Approval (outer).** A sheet at its medium detent in the kit's outer shape, its close button trailing in its own bar. While the system waits for the side button, its prompt takes the rail beside the button and the status steps aside.
- **StandBy (Standing, outer in landscape).** Full screen, with no rail, as Apple allows for immersive screens. The large clock stays clear of the camera's end.
