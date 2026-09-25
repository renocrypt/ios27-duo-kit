# Duo Hub — concept brief

Status: concept direction, version 0.1, September 23, 2026. Not yet prototyped or tested on a device. This brief combines four research notes, and row codes such as T12 or A3 refer to rows in those notes:

- [Device geometry and mockups](research/2026-09-23-device-geometry-and-mockups.md), cited as **G**.
- [Foldable prior art](research/2026-09-23-foldable-prior-art.md), cited as **P**.
- [Time and knowledge](research/2026-09-23-hub-time-and-knowledge.md), rows **T**, **K**, and **H**.
- [Agent and ambient](research/2026-09-23-hub-agent-and-ambient.md), rows **A** and **B**.

The claims about Duo's behavior come from pre-release sources. The claims about how people will use the hub are hypotheses.

## Thesis

**The hinge is the attention dial.** On a phone with one screen, every item competes for the same surface. On Duo, the way the device is held or placed shows how much attention the person is giving it:

- **Closed and in hand:** a glance.
- **Open:** work.
- **Set down:** ambient.

The hub reads that signal and responds at the same depth. Opening the device is how the person moves something from the edge of their attention to its center. Calm-technology research says the person, not the system, should control that move (Weiser and Brown, B4).

Three consequences follow:

1. **One hub at different depths.** Every posture shows the same hub at a different depth, never a different app. Opening shows more about the item already in view, not more items (T7, H6, and the Duo HIG's continuity rule).
2. **The data is unified; the screen shows only what matters now.** The hub joins the person's information underneath and shows only the relevant part. Dashboards of always-on tiles failed (H4, H5).
3. **The agent works beside the person.** It sits next to the content it acts on. It gains authority only when the person grants it (A1–A4).

## Structure: two spines, two layers

| Element | What it holds | Hub area | Evidence |
| --- | --- | --- | --- |
| **Today** (spine) | One timeline of events, tasks, and time blocks, fed by one inbox. Holds the active context: Work, Personal, or Sleep | Time and attention | T1–T4 |
| **Memory** (spine) | One personal index of notes, saved items, documents, and people. Browsed by time, person, and project, with semantic search alongside | Personal knowledge | K1, K2, K5 |
| **Home** (layer) | The current state of rooms, devices, media, and scenes | Ambient and home | B6 |
| **Agent** (layer) | An assistant that acts across both spines and Home, plus an Activity ledger of everything it did | AI agent | A1–A10 |

**Navigation:** four destinations plus search. On the outer display and in inner landscape, this is a vertical tab bar in one capsule, plus a separate search circle, on the right-edge rail (G).

**Bridges between the spines** make the hub feel like one thing:
- a "Heads Up" card joins the next event from Today with the person's history from Memory (K5);
- knowledge is grouped by active project, so it links back to Today (K7).

## Posture model

This model replaces the README's single "tabletop" station. Apple's own vocabulary separates **Standing**, folded like a tent, from **Seated**, propped open like a laptop (G, B1).

| Posture (Apple term) | Display and canvas | Attention | What the hub shows | What the person can do |
| --- | --- | --- | --- | --- |
| **Closed** | Outer display, 466 × 678 pt, portrait. Bars on the right rail | A glance: the *short look* | Now and next from Today. Items from key people that break through. How many items are held, and when the next digest arrives. The agent's status, shown as a Live Activity | Reply, snooze, or defer inline (H1). Capture in one gesture (K4). Stop the agent. Answer simple approvals |
| **Open**, landscape | Inner display, 951 × 669 pt. Bars on the right rail | Work: the *long look* | At most two panes: the main view (the Today timeline or Memory browsing) and a supporting pane (item detail or the agent) | Plan and shut down the day. Work through the digest. Use the "Change" path of approvals. Configure the hub |
| **Open**, portrait | Inner display, 669 × 951 pt. Horizontal bars | Reading | One long item: a note, a document, or the day's plan | Read and annotate |
| **Book** (partly folded) | Inner display, landscape. The fold region is active | Reading and comparing, held in the hands | Two pages: a note and its source, or an item and the agent's plan | Nothing interactive within the fold band |
| **Seated** (propped open) | Inner display, portrait. The fold runs horizontally | A situational station: kitchen, desk, workout, or call | Top half, readable at a distance: now and next, home status, agent status | Bottom half: media controls, 3–4 favorite home toggles, a scene mode, and pending approvals when unlocked (B2, B6) |
| **Standing** (tent) | Outer display, landscape, 678 × 466 pt | Ambient | StandBy-style faces, each answering one question: the time; the next event, shown only as free or busy; home; whether the agent is busy. A red tint at night (T9, B4, B5, B7) | Nothing is required. A tap, or approaching the device, brings more detail (B3) |

### Transitions

- **Opening brings an item to the center.** The item on the outer display becomes the selected item on the inner display, and its list appears in the other pane. This follows Android's list-detail rule (P §4). Each inner half is about the size of the outer display (G), so the closed view can become one pane without reflowing.
- **Which pane it lands in is an open design question.** Apple's AR model confirms that the outer display is on the back of the left half ([physical reference](research/2026-09-23-device-physical-reference.md#reviewer-pass-usdz-variants)). Physical continuity would therefore put the outer view in the **left** pane. Apple's landscape convention puts content on the right and sidebars on the left (P §6). Test both mappings.
- **Closing keeps the person's place.** The detail survives closing. The outer display offers to continue the current item but does not force it (Samsung's "swipe up to continue", P §2).
- **Unfolding may be the right moment to deliver held notifications.** Held notifications would arrive as a digest when the person opens the device, not in the middle of a glance (T12). This is untested, and it could train people to unfold compulsively.

### Which postures matter most

Closed and Open carry the concept. Prior art proves a complete outer display and a two-pane inner display. Evidence that people use propped poses every day is weak (P scorecard, H7). Seated and Standing are therefore a bonus layer: cheap to support, built on StandBy's visual rules, and never required for any task.

## Agent: one consent ladder

Apple, Google, OpenAI, and the research all converge on one control model (A1). The hub makes it a primitive of the design system and adds one thing: each step appears in a particular place depending on posture.

| Rung | Examples across the areas | What happens | Where it appears |
| --- | --- | --- | --- |
| Read | Search Memory, summarize a thread, check the calendar | Runs | The result appears in the supporting pane |
| Personal and reversible | Move a personal time block, turn on lights, save a note | Runs, with an Undo toast (A5) | A toast on either display |
| Shared, external, costly, or irreversible | Change an event that has attendees, send a message, share a note, unlock a door | Pauses and offers **Approve**, **Change**, or **Decline**. States the consequence, the source, and whether it can be undone (A3) | The outer display offers Approve or Decline. **Change** opens the plan on the inner display |
| Credentials, money, or security | Payments, passwords, locks, cameras | The agent prepares the action and the person completes it: "Your turn" (A2) | Touch ID on the side button, or opening the device. Hidden while the device is locked, or in Standing or Seated (B7) |

Supporting rules:

- **Beside the content, not instead of it.** The agent is a supporting pane next to the content, never a full-screen app (A8). Apple's own example is "a conversation with Siri AI while looking at content on the other side of the screen" (P §6). On the outer display it becomes a sheet.
- **Visible and interruptible.** When the device is closed, a running task shows as a Live Activity with a Stop control. When it is open, the task shows as a list of steps: done, current, and planned (A4).
- **One ledger.** An Activity view lists what the agent did. It can be filtered by area, and each entry links to its undo (A6). The person sets how independently the agent acts in each area, and approval cards show that setting (A7).
- **A fixed set of components.** The agent builds its answers from the hub's own components (event, note, device, approval, progress), not from freely generated interface (A9).
- **AI triage is labeled and reversible.** The AI can do three things to incoming items, and each is shown as a separate action:
  - *condense*: summarize;
  - *rank*: reorder by priority;
  - *hold*: keep for the next digest.

  Every line the AI wrote is marked. The original opens in one tap. The reason for a ranking is shown, and dismissing takes one gesture (T5, T6, K8). The hub shows how recently its index was updated, and it says "I can't see that yet" rather than guess.
- **Confirm by consequence, not by habit.** People stop reading a repeated confirmation after seeing it twice (A1).

## Attention rules

- **Quiet by default, never silent.** About three scheduled digests a day. Key people can break through. The number of held items and the time of the next digest are always visible. The default is batching, not all notifications off; turning them all off raised anxiety (T12).
- **People before apps.** Ranking starts with who sent something, not which app it came from (T6, T10).
- **Rituals over settings.** Three daily rituals:
  - **plan**, possibly at the first unfold of the day;
  - **focus**, shown as a Live Activity;
  - **shut down**, with a short review (T2, K6).

  Contexts are inferred from the calendar, limited to two or three, and can be overridden with one tap on the outer display (T3, T4).
- **Capture in one gesture; process on a schedule.** Capturing on the outer display files nothing. The agent proposes a follow-up, such as a reminder or an event, and the person confirms it during a ritual. The inbox is a queue with a set length (K4, K7).
- **Calm surfaces.** A module changes only when its data changes. Ambient states have no looping motion. The closed display is text-first and uses little color (H3, H4, B4).

## What the concept rejects

| Rejected pattern | Reason |
| --- | --- |
| One view spread across the fold | "Words and pictures get broken up" (P §1). Duo moves content away from the fold |
| A touchpad, or dense controls, on the lower half | Samsung kept its version in Labs, then dropped it (P §2). Seated's bottom half holds only media, a few toggles, and approvals |
| A thin glance strip on the closed device | Surface Duo's Glance Bar failed. The outer display is a complete surface (P §1) |
| Three or more panes | Reviewers stop at two (P scorecard) |
| A dashboard of live tiles | Windows Phone's Live Tiles, and Samsung's Now Brief at launch (H4, H5) |
| A full-screen agent app | The Humane AI Pin and Rabbit R1 stood apart from the phone (A8) |
| Silently recording everything | The backlash to Microsoft's Recall (K3) |
| A launcher as the first screen after opening | Opening must reward the person immediately (P, implications) |

## Concept-only departures

As a concept, the hub assumes system-level access that a third-party app does not have. The prototype marks each of these:

1. Reading, reordering, and holding all system notifications for digests (T5, T §6).
2. One personal index spanning Mail, Messages, files, and web history (K9).
3. Owning the outer display's home and lock screens, and full StandBy faces (T §6, A §5).
4. Delivering notifications when the hinge moves (T §6).
5. Agent actions beyond App Intents, including Gemini-style automation of the screen (A §5).
6. Agent tasks longer than the 8-hour limit on Live Activities (A §5).
7. Sensing when someone approaches in StandBy; Apple does not document such a sensor (A §5, B3).
8. Agent control of secure home devices (A §5).

## Prototype direction

**First journey: a day with Duo.** One continuous story that covers every area and posture.

1. **Night to morning, Standing.** The bedside clock face, tinted red at night. The agent face shows that an overnight task has finished.
2. **Picking the phone up, Closed.** Now and next. "7 held · next digest 9:00". An inline reply to one message that broke through.
3. **First unfold, Open.** The planning ritual: Today in the main pane, and the agent's proposed plan beside it. A check of how much fits in the day. One Approve and one Change.
4. **During the day, Closed.** A voice capture of an idea. The agent's running task, shown as a Live Activity. An approval that needs Touch ID.
5. **A research moment, Book.** A note beside its source.
6. **Evening, Seated on the counter.** A recipe from Memory on the top half. A timer, lights, and music on the bottom half.
7. **Shutdown, Open.** A review of the day, the agent's ledger, and tomorrow's first block.
8. **Night, Standing.** Back to the calm face.

**Geometry.** Use the prototype geometry sheet (G):
- the outer display is 466 × 678 pt and the inner display 951 × 669 pt, both at @3x;
- the outer display's corners are 8 pt on the hinge side and 59 pt on the free side; the inner display's corners are 55 pt;
- use concentric shapes with a recorded minimum radius.

The fold band (27 pt) and the rail (about 80 pt) are labeled placeholders. Recheck the point sizes and radii in the Device Hub of Xcode 27.1.

**Assets.** Draw our own device outlines for every posture. Apple's bezels show only flat views. Their license forbids embedding them in software, modifying them, or animating them (G).

**Medium (decided September 23: web technology, with Three.js and Anime.js).** The prototype is built with HTML, CSS, and JavaScript. Three.js renders the device in 3D, and Anime.js choreographs motion across the 3D scene and the DOM. The first step is research into how to model the device faithfully from official measurements. An interactive web prototype with a posture switcher is the fastest way to build a faithful prototype:
- StandBy and reserved regions do not run in the beta simulator;
- Apple's bezels could not be embedded anyway;
- the concept exceeds what a SwiftUI app could do on the device.

A SwiftUI build becomes worthwhile after October 23, to test how the hub feels on hardware.

## What to test

| Question | How |
| --- | --- |
| Is unfolding a good moment to deliver the digest? | Log opens, closes, and digest reads in the prototype. Compare with scheduled delivery |
| Should the outer view land in the left pane or the right pane? | Confirm the hinge side in Device Hub. Test both mappings |
| Do people use Seated and Standing, or ignore them? | Observe after launch on October 23 (P §7) |
| Do people understand the consent ladder? | Walk people through tasks with the Approve / Change / Decline sheet at each rung |
| Can people reach the side button for Touch ID one-handed, with either hand? | Check on hardware after launch. GQ raised a question about left-hand use ([signal audit](research/2026-09-23-signal-audit.md)) |
