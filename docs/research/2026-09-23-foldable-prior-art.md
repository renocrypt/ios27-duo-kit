# Foldable and dual-screen prior art for the Duo hub

Checked: September 23, 2026. Scope: lessons for the [hub concept](../../README.md) from Microsoft Surface Duo, Samsung Galaxy Z Fold, Google Pixel Fold and Pro Fold, Android's canonical layouts, and Huawei, Honor, OPPO/OnePlus, and vivo foldables. Also covers early third-party readings of iPhone Duo's UI and published evidence on how people use foldables. This note builds on the [signal audit](2026-09-23-signal-audit.md) and [source index](2026-09-23-source-index.md) and does not re-review Apple's HIG, Tech Talks, or APIs.

**Tiers:** **V** = official vendor · **R** = firsthand report or review · **S** = research study or survey · **D** = designer opinion. **†** = seen only in search results; the page was not opened because it was blocked or not fetched. Quotes without † come from pages opened in this session.

## Short answer

- **Proven patterns:** These shipped on several platforms, lasted across generations, and appear in iPhone Duo:
  - two panes on the large display (list-detail and a supporting pane);
  - two apps side by side, with saved pairs;
  - a persistent app switcher;
  - a complete outer display;
  - state that survives opening and closing.
- **Proven, but only for narrow moments:** These features lasted, and Apple adopted versions of them, but they serve specific moments rather than daily use:
  - outward uses of the second display, such as a dual-screen interpreter, a camera preview facing the subject, and an animation to get a child's attention;
  - hands-free viewing with the device propped up.
- **Gimmick-prone:**
  - the Flex Mode touchpad panel;
  - spanning one app across a seam;
  - tiny closed-state glance strips;
  - three-app splits;
  - drag-to-app sidebars.

  The evidence includes a feature kept in "Labs," reviewers who "never found much utility," a 2026 flagship that dropped Flex Mode (two of the three reviewers checked did not miss it), and reviewers who don't use these features daily.
- **Low friction to open drives use of the inner display.** Wide foldables that open easily get opened much more (reviews of the Galaxy Z Fold 8). iPhone Duo's matched 1:1.4 ratio follows this trend. The hub should treat the inner display as a frequent workspace, while still letting people finish triage on the outer display.
- **Usage data is thin.** I found no verified logging study of how often people fold the device or which poses they use. The most-cited figures (3.1 unfolds a day; 76% never used hover) come from a secondary report of an unnamed Counterpoint survey.

## 1. Microsoft Surface Duo (2020–2024)

| Aspect | Finding | Source (tier) |
| --- | --- | --- |
| What shipped | Two 5.6-inch 4:3 screens joined by a hinge, with no outer display. Apps ran one per screen, or "spanned" across both. Microsoft published five patterns: extended canvas, list-detail, two-page, dual view, and companion pane. | [MS dual-screen introduction, now archived](https://learn.microsoft.com/en-us/previous-versions/dual-screen/introduction) (V) |
| Design principles | "Provide continuous value." "Don't bury fundamental functionality in the spanned state." Apps "shouldn't automatically enter a spanned state without an intentional, user-initiated action." | Same (V) |
| Observed behavior | Microsoft saw a "tendency": in dual-landscape, people use both screens to expand the content area; in dual-portrait, they multitask and group content. "Our studies show that users are more comfortable typing or writing on a flat surface." For companion panes, tools "on the right or bottom" suit ergonomics. No study details were published. | Same (V) |
| Reception | Reviewers praised the hardware and running two apps side by side. They panned the bugs, the camera, and the price. On spanning: "words and pictures get broken up and lost." The Duo worked best as "two screens stuck together, like a laptop connected to an external monitor." On Duo 2: it "isn't that comfortable to hold … in the 'book' orientation for a prolonged period," while app groups made dual-screen work "revelatory" in the right conditions. | [Engadget, Duo](https://www.engadget.com/microsoft-surface-duo-review-software-camera-specs-130024046.html) (R); [PCWorld, Duo 2](https://www.pcworld.com/article/545199/microsoft-surface-duo-2-review.html) (R); [The Verge via Techmeme](https://www.techmeme.com/200910/p9) (R†) |
| Closed-state glance | With no outer display, the Duo relied on "Peek" (opening the device slightly). Duo 2 added a hinge-edge "Glance Bar" that showed the time and colored alerts. At first it covered only calls, SMS, and Teams ("No WhatsApp, no Slack, no Outlook, nothing"). Reviewers found it too small and easy to miss. | [Windows Central](https://www.windowscentral.com/surface-duo-2s-glance-bar-feature-needs-do-more) (R†); [Engadget, Duo 2](https://www.engadget.com/microsoft-surface-duo-2-review-camera-sample-specs-glance-bar-130004036-130004890.html) (R†) |
| Why it struggled | The $1,500 Duo 2 received one major OS upgrade, and support ended October 21, 2024. Android Police blamed "better competition, subpar specs, and an overall poor software experience." | [Android Police](https://www.androidpolice.com/microsoft-surface-duo-2-end-of-life/) (R) |
| What lasted | Microsoft mapped its companion pane to Android's supporting pane and its list-detail to Android's list-detail. It kept extended canvas, dual view, and two-page as distinct patterns. App groups resurface as Samsung App pairs and as Duo's "save pairs of apps." | [Surface Duo blog, Nov 2022](https://devblogs.microsoft.com/surface-duo/large-screen-design-patterns/) (V); [Apple newsroom](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/) (V) |

**Lesson:** The side-by-side patterns lasted. Spanning a single view across a physical gap, closed-state glances, and unreliable software sank the Duo's experience. The Duo's own principles remain sound: the extra space must add continuous value, it must not hold basics hostage, and the user must control transitions.

## 2. Samsung Galaxy Z Fold

| Feature | What shipped | Reception and fate | Source (tier) |
| --- | --- | --- | --- |
| Flex Mode panel | When the phone is half-folded, the app sits on top and a panel with a touchpad and scroll wheel sits below. Users opt in per app, the panel dims when idle, and "the touchpad is not available in split screen view." On the Fold4 the panel lived under "Labs." Samsung's guidance: "Show content on the top and provide controls on the bottom," for camera, video, and video calls; avoid interactive elements "near the crease." | Mixed to weak. "I never found much utility for Flex mode on the previous Z Folds." One long-time user used it for desk video but doesn't miss it. A dissenting reviewer calls it "an important part of that folding experience." The 2026 Fold 8's spring hinge "can no longer maintain its position at 90 degrees"; "only the Galaxy Z Fold 8 Ultra retains Flex Mode support." | [Samsung support](https://www.samsung.com/us/support/answer/ANS10003471/) (V); [Samsung UK, Labs](https://www.samsung.com/uk/support/mobile-devices/what-is-the-flex-mode-of-galaxy-z-flip4-and-galaxy-z-fold4/) (V†); [Samsung dev](https://developer.samsung.com/OneUI/foldable-and-largescreen/foldable-excl-flex.html) (V); [Gizmodo](https://gizmodo.com/samsung-galaxy-z-fold-8-review-the-most-fun-phone-in-ages-2000792547) (R); [Android Authority](https://www.androidauthority.com/galaxy-z-fold-8-flex-mode-3704800/) (R); [Android Police](https://www.androidpolice.com/samsung-galaxy-z-fold-8-misses-pivotal-foldable-tool/) (R); [Engadget](https://www.engadget.com/2225231/samsung-galaxy-z-fold-8-review/) (R) |
| Taskbar | Introduced on the Fold4 in 2022 with Android 12L. It is a persistent dock of favorite and recent apps; users drag from it to open a split or pop-up window. | Widely praised; it was backported to older Folds and is still a standard setting in 2026. | [9to5Google](https://9to5google.com/2022/08/10/galaxy-z-fold-4-android-12l-taskbar/) (R†); [Samsung support](https://www.samsung.com/us/support/answer/ANS10013184/) (V) |
| Multi-window | Split screen with up to three apps, pop-ups, and saved app pairs. | Samsung says Fold users use Multi Window "five times more often" than Galaxy S26 Ultra users, without giving a method. A Samsung executive said more first-generation owners used it "than we would have thought" (†). Reviewers cap it at two apps: "I wouldn't recommend running more than two apps side by side." | [Philstar interview, Sep 16, 2026](https://philstartech.com/news/features/2026/09/16/19668/eight-years-of-setting-the-standard-how-samsung-shaped-the-foldable-category/) (V via R); [TechRadar](https://www.techradar.com/au/in/news/how-samsungs-first-foldable-phone-mistakes-paved-the-way-for-galaxy-z-fold-2) (R†); Gizmodo (R) |
| App continuity | "Continue apps on cover screen" offers three options: Always, "Swipe up to continue app," or Never. Samsung's developer guidance: keep scroll position and text input. | A must-have, but fragile. Samsung documents that after Android 16 the app refreshes instead of continuing. | [Samsung support](https://www.samsung.com/us/support/answer/ANS10013184/) (V); [Samsung troubleshooting](https://www.samsung.com/us/support/troubleshoot/TSG10010026/) (V†); [Samsung dev](https://developer.samsung.com/OneUI/foldable-and-largescreen/foldable-excl-flex.html) (V) |
| 2026 wide Fold 8 | A passport-style phone with a 4:3 inner display; tabletop is no longer supported, but tent mode remains. | Reviewers opened it far more often. Gizmodo: "the only one that I have unfolded more times than I have not"; on the Fold 7 that reviewer used the inner display "maybe less than 50% of the time." Android Authority: "I almost always unfold it." Engadget called it "a superior content consumption device," with the Ultra still better for heavy multitasking. | Gizmodo, Android Authority, Engadget (R) |

## 3. Google Pixel Fold and Pro Fold (2023–2026)

| Feature | What shipped | Reception and fate | Source (tier) |
| --- | --- | --- | --- |
| Outer display as a full phone | "When closed, the exterior screen lets you do all the usual tasks you'd expect." | The original's wide cover display earned praise for one-handed use ([Buondonno](https://www.matridox.com/p/google-pixel-fold-review), R†). | [Google blog, May 2023](https://blog.google/products-and-platforms/devices/pixel/google-pixel-fold/) (V) |
| Tabletop mode | "Go hands-free with tabletop mode … watch content or capture photos or videos without a tripod." The phone takes timed group photos triggered by a palm gesture, and tent mode enables astrophotography. | Kept on every Pixel Fold. Apple's Duo launch copy likewise has users "prop iPhone Duo up" for time-lapse. | Same (V); [Pixel camera help](https://support.google.com/pixelphone/answer/13632627?hl=en) (V); [Apple newsroom](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/) (V) |
| Dual Screen interpreter | The inner and outer displays show each speaker the translation of the other's words; it shipped with Android 14 in October 2023. Android exposes this as "dual-screen mode." | "Cuts down on the typical back and forth" (†). At launch it could be opened only through Google Assistant, and 9to5Google urged a dedicated button in Translate. It later moved into Translate and reached Samsung foldables (†). | [Android dev](https://developer.android.com/develop/adaptive-apps/guides/foldables/support-foldable-display-modes) (V); [Engadget](https://www.engadget.com/the-google-pixel-folds-dual-screen-interpreter-begins-rolling-out-170003067.html) (R†); [9to5Google](https://9to5google.com/2023/10/19/pixel-fold-dual-screen-translate/) (R); [SamMobile](https://www.sammobile.com/news/google-translate-dual-screen-galaxy-z-fold-6/) (R†) |
| Outward camera | Rear Camera Selfie; Dual screen preview on every Pixel Fold through the 11 Pro Fold; Made You Look (a cover-display animation for children) on the 9, 10, and 11 Pro Fold. | These lasted across generations. Apple ships equivalents: "Duo Preview" and "Kid Cue," which "plays animations from Peanuts on the outer display." | Pixel help (V); Apple newsroom (V) |
| Wide form factor | The original Fold had a wide cover display and an inner display wider than it was tall. | Apps that hadn't been adapted were letterboxed; the 9 Pro Fold moved to a standard 20:9 cover (†). Android Authority's Rita El Khoury: "I wanted to hold my phone open like a book, not like a laptop … but I couldn't." Android 16 and 17 now override apps' orientation locks on large screens. | [Android Authority, Feb 2026](https://www.androidauthority.com/why-android-killed-wide-foldables-how-ressurecting-them-3641324/) (R/D); [Android Authority](https://www.androidauthority.com/pixel-9-pro-fold-aspect-ratio-3470746/) (R†) |

## 4. Android canonical layouts

| Layout | Definition and adaptive rule | Hub use |
| --- | --- | --- |
| List-detail | Two panes side by side at expanded width; one pane at a time on narrower screens. When the width narrows, "the detail pane remains visible and the list pane is hidden." When it widens again, the list shows the selected item. | Inbox, tasks, notes, and search results. Closing the device keeps the item open, not the list. |
| Supporting pane | The main content takes about two-thirds of the window. "Secondary pane content is meaningful only in relation to the primary content." On narrow screens it becomes a sheet. | The agent, related context, and tools beside the item in focus. |
| Feed | A grid of equivalent cards that "can adapt from a single, scrolling column to a multi-column" feed. | Today view, saved items, and ambient cards. |

Source: [Android canonical layouts](https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts) (V). These rules match Apple's ArrangementView and continuity guidance, already indexed. The value is Android's explicit **state rules on resize**, which the hub can adopt as testable acceptance criteria.

## 5. Other foldables: notable UX ideas

| Vendor and idea | What it does | Evidence and reception | Take for the hub |
| --- | --- | --- | --- |
| Huawei App Multiplier | System-level list-detail inside a single app: tapping content moves the home page left and opens the content on the right. It is turned on per app in Settings. | [Huawei support](https://consumer.huawei.com/en/support/content/en-us15950833/) (V†). No usage data found. | Precedent for a hub that imposes two-pane structure on content it does not own. |
| Huawei Pura X (2025) | A 16:10 wide inner display; a 3.5-inch square cover display for messages, navigation, media, and calls. | The cover display is "big enough for simple tasks," but "once you open it, you have to turn it 90°." | [GSMArena](https://m.gsmarena.com/huawei_pura_x_handson-news-67352.php) (R). An orientation mismatch adds friction; Duo's matched ratio avoids it. |
| Tent Mode research (MobileHCI '20) | Tent mode as primary, secondary, and edge displays for sharing with people nearby, such as passing photos to a stranger "without disrupting the owner's privacy." | Interviews, a collaborative-task study, and preliminary feedback (from the abstract). | [ACM](https://dl.acm.org/doi/10.1145/3379503.3403566) (S†). Supports an outer display that faces other people while the owner keeps the private side. |
| Honor Magic Portal | Long-press any content to get a sidebar of suggested apps and actions. | "Works well enough, but it's not something I use daily" (†). | [Digital Trends](https://www.digitaltrends.com/phones/honor-magic-v6-review/) (R†). Drag-to-act is a secondary path, not a primary entry point. |
| Honor YOYO agent | Honor says it can generate decks from articles and book a ride across several ride-hailing apps, "cancelling other orders once a ride is booked," by talking to agents inside those apps. | These are vendor claims, reported by the press; I found no usage data. | [SCMP, Jul 2025](https://www.scmp.com/tech/tech-trends/article/3316692/honor-launches-thinnest-foldable-smartphone-new-ai-agent-amid-steep-competition) (V via R). Closest shipped precedent for the hub's cross-app agent. |
| OPPO Find N3 / OnePlus Open "Open Canvas" | A virtual canvas wider than the display: apps sit partly off-screen, and "the UI zooms into that app … pans over to that one." It gives a full-size keyboard and saved groups. | "The best multitasking system I've ever used on any phone or tablet" (XDA headline). One owner reported uneven split sizes (†). | [XDA, Jan 2024](https://www.xda-developers.com/oneplus-open-best-multitasking-system/) (R). A spatial model could arrange the hub's four areas in space. |
| vivo X Fold5 "Smart screen shift" | "Automatically switches the active display to the cover screen when a specific orientation is detected," though it can misfire during overhead photos. Multi-window is "not quite as polished" as One UI's. | The China-only build also bridges iPhone calls and notifications and iCloud files (†). | [GSMArena](https://www.gsmarena.com/vivo_x_fold5-review-2859p4.php) (R); [9to5Google](https://9to5google.com/2025/06/25/vivo-x-fold-5-launch-dust-apple-watch/) (R†). Precedent for Duo's "switches to the appropriate display when flipped over." |

## 6. Early third-party readings of iPhone Duo's UI

All of these are pre-release, based on briefings, videos, or short hands-on sessions.

| Source | Claim relevant to the hub | Tier |
| --- | --- | --- |
| [Nob Nukui, Sep 12](https://note.com/nobtaka/n/n914a7ff8e209?hl=en) (English rendering of a Japanese post) | "I still don't see many situations where I think, 'I need a big screen, so I have to open it here.'" On side bars: "three chevrons in a row … hard to tell what is what." | D |
| [Punit Chawla, Medium](https://medium.com/design-bootcamp/iphone-duos-ux-design-finally-makes-foldables-useful-but-misses-the-mark-a3919ddad648) | Criticizes the lack of a persistent dock once apps are open, compared with Samsung and OPPO. | D† (page returned HTTP 403) |
| [DesignWhine, Sep 16](https://www.designwhine.com/iphone-duo-responsive-design-system/) | "A foldable does not just add another breakpoint. It adds another moment in which your product has to decide what should stay, what should move and what should transform." Recommends prototyping transitions, not only end states. | D |
| [Dorve, Sep 9](https://dorve.com/blog/iphone-duo-design-object/) | "The point of a foldable is not that it folds. It is that folding should never cost you your place." | D |
| [Yanko Design, Sep 10](https://www.yankodesign.com/2026/09/10/this-single-ui-trick-might-sell-more-iphone-duo-units-than-any-android-foldable/) | The same 1:1.4 ratio open and closed; the opening animation is the differentiator. | D |
| [9to5Mac, Sep 18](https://9to5mac.com/2026/09/18/iphone-duo-videos-reveal-split-keyboard-app-multitasking-more/) | In landscape, "content on the right and sidebars on the left"; a split keyboard; a page-flip reading view when the device is partly folded. | R |
| [TechRepublic](https://www.techrepublic.com/article/news-iphone-duo-ios-27-foldable-features/) | Samsung's Multi Window, Taskbar, and DeX remain the deeper multitasking system. | R† (page returned HTTP 403) |

**Where Apple's launch features draw on prior art:** Apple's own launch copy lists these features, each with an earlier equivalent ([newsroom](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/), V):

| iPhone Duo feature | Earlier equivalent |
| --- | --- |
| "Save pairs of apps" | Surface Duo app groups; Samsung App pairs |
| "A conversation with Siri AI while looking at content on the other side of the screen" | Companion pane; supporting pane |
| Duo Preview and Kid Cue | Pixel Dual screen preview; Made You Look |
| StandBy "on either the outer or inner display — even when it's not charging" | Tent and tabletop viewing on Surface Duo, Pixel Fold, and Galaxy Z Fold |
| Content "switches to the appropriate display when flipped over" | vivo Smart screen shift |

## 7. How people actually use foldables

| Question | Best available evidence | Tier | Confidence |
| --- | --- | --- | --- |
| How often do people open the device? | "Unfold the inner screen only 3.1 times a day on average." The report attributes this to "Counterpoint survey," with no year or sample given; I could not find the original. Reviewers: the Fold 7's inner display was used "maybe less than 50% of the time," and the Fold 8 was unfolded more often than not. Samsung still shows no screen time per display. | [36Kr, Apr 2026](https://eu.36kr.com/en/p/3768858604974599) (R citing S, unverified); Gizmodo (R); [SamMobile, Sep 2026](https://www.sammobile.com/opinion/7-years-later-galaxy-z-fold-8-cant-count-screen-usage-properly) (R) | Low |
| How much do people use tabletop or hover? | "76% of consumers have never used the hover function" (same unverified source). Reviewers split: "never found much utility" versus "an important part." Samsung dropped Flex Mode on the 2026 base Fold. | 36Kr (unverified); Gizmodo, Android Authority, Android Police (R) | Low |
| Do people multitask? | Samsung reports 5× the Multi Window use of its slab flagship. NN/g participants used split screen to see "overview plans and detailed drawings" together. Reviewers stop at two apps. Among US adults interested in a foldable, 34% cited multitasking or split screen as a feature they care about, versus 75% for long battery life. | Philstar (V); [NN/g, Jan 2025](https://www.nngroup.com/articles/foldable-smartphones/) (S, qualitative, n not stated); Gizmodo (R); [YouGov, Nov 2024](https://yougov.com/en-us/articles/50945-foldable-phones-high-interest-among-young-adults-durability-a-major-concern) (S, n=1,002) | Medium |
| Do people switch modes within a task? | Fifteen owners of foldables and 2-in-1s reported "regularly moving through multiple configurations or input modes" while using a single product or completing a single task. NN/g advises consistency so users don't have to "relearn the app." | [IMX '21 paper](https://ouci.dntb.gov.ua/en/works/leqQJmEl/) (S†, abstract only); NN/g (S) | Medium-low |
| Fatigue and ergonomics | Holding a book-style device for long periods is uncomfortable (PCWorld). Typing is easier on a flat surface (Microsoft). The wide Pura X must be rotated after opening. The first Surface Duo "requires two hands." | PCWorld, Engadget, GSMArena (R); MS (V) | Low-medium; anecdotal |
| Why people pass on foldables | Among US adults not interested in a foldable: durability 56%, cost 53%, "do not see a substantial advantage" 40%, bulk 29%, and software optimization 13%. In China, Counterpoint found durability, crease, and bulk to be the main barriers (†). | YouGov (S); [Counterpoint, Nov 2023](https://counterpointresearch.com/en/insights/nearly-two-thirds-of-high-end-smartphone-users-in-china-are-open-to-foldables-survey) (S†) | Medium |
| What gets abandoned or hidden | Surface Duo's Peek and Glance Bar. Flex panel kept in Labs, then dropped. Interpreter hidden behind Assistant. Split-screen gestures off by default in One UI 9 (†). Magic Portal "not something I use daily" (†). | Cited above; [SamMobile](https://www.sammobile.com/news/must-try-multitasking-gestures-galaxy-z-fold-8-ultra/) (R†) | Medium as a pattern; no rates |

## Scorecard: proven or gimmick-prone

| Pattern | Verdict | Deciding evidence |
| --- | --- | --- |
| Two panes on the inner display (list-detail or supporting pane) | **Proven** | Microsoft, Android, Huawei, and Apple all converge on it; NN/g participants used overview and detail together. |
| Two apps with saved pairs | **Proven** | Surface Duo app groups → Samsung App pairs → Duo saved pairs; Samsung reports 5× Multi Window use. |
| Three or more panes | **Weak** | Reviewers advise at most two ("very skinny" windows). |
| Persistent dock or taskbar | **Proven** | Praised on the Fold4, still standard in 2026, and its absence is criticized on Duo (†). |
| State continuity when folding | **Proven must-have; fragile** | Samsung offers three user-chosen modes and documents a regression; Microsoft insists users are in control. |
| Complete outer display | **Proven** | Pixel Fold and Fold 8 cover displays are used as full phones; Surface Duo's glance strips failed. |
| Spanning one view across a seam or fold | **Gimmick-prone** | "Words and pictures get broken up"; Microsoft itself warns against gating basics behind spanning. |
| Touchpad or controls on the lower half when half-folded | **Gimmick-prone** | It stayed in Labs, requires per-app opt-in, and reviewers rarely used it; one 2026 flagship dropped it. |
| Hands-free propped viewing (video, calls, group photos, StandBy) | **Proven for specific jobs** | Kept by Google and Samsung Ultra; Apple added StandBy without charging; daily-use rates are unknown. |
| Outward display for another person (interpreter, subject preview, kid cue) | **Proven, narrow** | It survived Pixel generations, spread to Samsung, and Apple copied it; its uptake depended on discoverability. |
| Drag content to a suggested app | **Weak** | It is useful but not used daily (†). |
| Spatial canvas (Open Canvas) | **Promising, single-vendor** | Strong praise in reviews; no usage data. |
| Cross-app AI agent on foldables | **Unproven** | Vendor claims only. |

## Implications for the hub concept

**Time and attention**
- Finish triage on the outer display: reply, snooze, or defer without opening the device. Surface Duo shows that a partial glance surface fails. The Pixel Fold and Fold 8 show that a usable cover display handles quick tasks; Engadget says the Fold 8's cover display handles maps and texts well enough that you don't "feel pressured to open it."
- Make the inner display the planning surface: the day's list next to the details of the selected item. Wide, low-friction foldables are opened more than half the time, so opening must reward the user right away. Do not show a launcher first.
- Treat closing mid-task as a first-class action. Follow Samsung's user-chosen "swipe up to continue": the outer display offers the current item without forcing it.

**Personal knowledge**
- Use list-detail by default and adopt Android's resize rules as acceptance tests: on closing, the detail survives; on opening, the list shows the selected item.
- Use two-page layouts (Surface Duo, Duo's page-flip reading view) for long reading, and dual view for comparing a note with its source. Do not build one view that spans across the fold.

**AI agent**
- Place the agent as a supporting pane beside the item in focus. This follows Microsoft's companion pane, whose tools sit "on the right or bottom," and Apple's "Siri AI while looking at content on the other side." On the outer display, it becomes a sheet.
- Honor YOYO is the only shipped precedent for cross-app action, and its usage is unproven. Show the plan in the main pane before acting. Mark system-wide agency as a departure from what a third-party app can do.
- Drag-to-agent can be a secondary path; Magic Portal's reception argues against making it the primary entry point.

**Ambient and home**
- Evidence that people pose foldables every day is weak. Design the ambient station to be passive and glanceable. It should work without touch controls on the lower half, which is the part of Flex Mode people did not adopt.
- Duo's StandBy on either display without charging, plus Tent Mode research, suggests a two-sided station. The private side faces the owner, and the outer display shows household-safe status to others. Privacy rules for the outward side are a design requirement.
- Treat the station as a bonus. Samsung's well-reviewed 2026 Fold 8 cannot hold a tabletop angle, and two of the three reviewers checked did not miss it.

**Cross-cutting**
- Allow at most two panes plus one overlay.
- Keep a persistent switcher across the four areas.
- Make the user control every transition between displays.
- Put entry points for pose-specific features where the moment happens. The interpreter hidden behind Assistant and the Flex panel kept in Labs are warnings.
- Reliability outweighs novelty. Surface Duo's patterns were sound, but bugs and weak support sank it.

## Open questions and limits

- **No logging data.** I found no verified field study of how often people fold the device or which poses they use. The 3.1-a-day and 76% figures lack an original source. Samsung does not expose per-display screen time. The prototype should log opens, closes, poses, and which display is active.
- **Vendor figures lack methods.** Samsung's "5×" has no stated method and likely reflects who buys a Fold. Samsung's 2020 survey sampled prospective buyers, not owners ([Samsung HK](https://www.samsung.com/hk_en/news/product/six-reasons-why-foldable-smartphones-are-widely-welcomed/), S†).
- **Anecdotal reviews.** Most pose and fatigue evidence comes from single reviewers. Opinions on Flex Mode are split.
- **Unopened pages.** Pages marked † were not opened (The Verge, TechRepublic, Medium, Digital Trends, and ACM were blocked or timed out). I did not verify China-only features (vivo's Apple bridging, HarmonyOS) hands-on.
- **Duo is pre-release.** Third-party Duo UI analysis predates the device's availability, and some of it is opinion drawn from Apple's videos. Whether Duo's hinge reliably holds tabletop angles, and whether people use StandBy daily, remain open until after October 23.
