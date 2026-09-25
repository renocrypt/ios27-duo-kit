# iPhone Duo source index

Collected September 23, 2026 for the [signal audit](2026-09-23-signal-audit.md). The list favors original Apple publications, developer documentation, firsthand observations, and original research. A link's presence means it was located and checked for relevance; it does not imply every minute of a linked video was watched. Apple documentation describes intended behavior; beta references are provisional; short hands-on accounts are observation leads.

## Apple device and design guidance — authoritative

| Source | Distinct signal |
| --- | --- |
| [Apple's Duo announcement](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/) | Announcement date, intended use, and official form-factor framing. |
| [iPhone Duo product overview](https://www.apple.com/iphone-duo/) | Public feature and availability information; October 23 availability. |
| [iPhone Duo technical specifications](https://www.apple.com/iphone-duo/specs/) | Display, input, camera, size, and weight specifications. |
| [Get ready for iPhone Duo](https://developer.apple.com/iphone-duo/) | Official index of Duo videos, HIG, documentation, tools, labs, and Q&As. |
| [Designing for iPhone Duo — HIG](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) | Core Duo design rules: poses, reserved regions, layout, and vertical controls. |
| [What's new in Design](https://developer.apple.com/design/whats-new/) | Change log dating the Duo HIG addition to September 9. |
| [Layout — HIG](https://developer.apple.com/design/human-interface-guidelines/layout) | Adaptive layout, safe areas, visual hierarchy, and content/controls layering. |
| [Materials — HIG](https://developer.apple.com/design/human-interface-guidelines/materials) | Liquid Glass and standard material roles. |
| [Color — HIG](https://developer.apple.com/design/human-interface-guidelines/color) | Color and contrast behavior on Liquid Glass. |
| [Accessibility — HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Inclusive sizing, controls, motion, and assistive interaction guidance. |
| [Motion — HIG](https://developer.apple.com/design/human-interface-guidelines/motion) | System/custom motion and accessibility considerations. |
| [Toolbars — HIG](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Action grouping and toolbar presentation. |
| [Tab bars — HIG](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Navigation presentation and Liquid Glass tab behavior. |
| [Sidebars — HIG](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Expanded navigation and its material layer. |
| [Scroll views — HIG](https://developer.apple.com/design/human-interface-guidelines/scroll-views) | Scroll edge effects under floating controls. |
| [Sheets — HIG](https://developer.apple.com/design/human-interface-guidelines/sheets) | General presentation behavior to read alongside Duo sheet rules. |
| [Design principles — HIG](https://developer.apple.com/design/human-interface-guidelines/design-principles) | Apple's current design principles, reintroduced in 2026. |

## Dedicated iPhone Duo talks and Apple-led sessions

| Source | Distinct signal |
| --- | --- |
| [Design for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111466/) | Design intent, continuity, controls, sheets, and fold avoidance. |
| [Prepare your app for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111461/) | Size classes, scene geometry, safe areas, and resizability. |
| [Raise the bar with iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111462/) | Vertical bar axis, ordering, grouping, priority, and overflow. |
| [Strike a pose with adaptive layouts](https://developer.apple.com/videos/play/tech-talks/111463/) | Reserved regions, displacement, and split/overlay arrangements. |
| [Leverage multiple displays and scenes](https://developer.apple.com/videos/play/tech-talks/111464/) | Hinge context, multitasking, multiple scenes, and display accessories. |
| [Build a great camera experience](https://developer.apple.com/videos/play/tech-talks/111465/) | Camera selection and display-specific camera use. |
| [iPhone Duo Group Lab — recording 1](https://developer.apple.com/videos/play/meet-with-apple/285/) | One-hour Apple Q&A; located, full recording not reviewed. |
| [iPhone Duo Group Lab — recording 2](https://developer.apple.com/videos/play/meet-with-apple/286/) | Second Apple Q&A; located, full recording not reviewed. |

## SDK, design assets, and validation tooling — beta or evolving

| Source | Distinct signal |
| --- | --- |
| [Preparing your app for iPhone Duo](https://developer.apple.com/documentation/technologyoverviews/preparing-your-app-for-iphone-duo) | Technical overview linked by Apple's Duo hub. |
| [SwiftUI updates](https://developer.apple.com/documentation/Updates/SwiftUI) | September 2026 arrangement, reserved-region, and toolbar APIs. |
| [UIKit updates](https://developer.apple.com/documentation/updates/uikit) | UIKit equivalents for arrangements, hinge, regions, and vertical bars. |
| [Xcode 27.1 beta release notes](https://developer.apple.com/documentation/xcode-release-notes/xcode-27_1-release-notes) | Duo simulator support, preview features, and known limitations. |
| [ArrangementView](https://developer.apple.com/documentation/swiftui/arrangementview) | Adaptive primary/secondary layout primitive. |
| [ReservedRegion](https://developer.apple.com/documentation/swiftui/reservedregion) | SwiftUI representation of fold or camera-reserved space. |
| [UIView reserved regions](https://developer.apple.com/documentation/uikit/uiview) | UIKit reserved-region access for custom layouts. |
| [onHingeChange](https://developer.apple.com/documentation/swiftui/view/onhingechange%28isenabled%3A_%3A%29) | SwiftUI hinge state and angle observation. |
| [UIHingeInteraction](https://developer.apple.com/documentation/uikit/uihingeinteraction) | UIKit hinge observation. |
| [ToolbarVerticalCompressionBehavior](https://developer.apple.com/documentation/swiftui/toolbarverticalcompressionbehavior) | Bar compression preference under constrained vertical space. |
| [ToolbarOverflowMenu](https://developer.apple.com/documentation/swiftui/toolbaroverflowmenu) | System-managed secondary toolbar actions. |
| [Apple Design Resources](https://developer.apple.com/design/resources/) | Official UI kits and Duo assets. |
| [Build for iPhone Duo with new resources](https://developer.apple.com/news/?id=nyuppv9r) | September 18 announcement of Figma/Sketch kits and Xcode beta. |
| [Duo screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) | Official outer/inner image dimensions; upload support pending. |

## Liquid Glass and accessibility support

| Source | Distinct signal |
| --- | --- |
| [Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) | Platform design and implementation overview. |
| [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) | System components, custom adoption, and migration guidance. |
| [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/) | Apple design-team explanation of material behavior. |
| [Testing system accessibility features](https://developer.apple.com/documentation/accessibility/testing-system-accessibility-features-in-your-app) | Reduce Transparency, contrast, and motion testing. |
| [Refine accessibility for custom controls](https://developer.apple.com/videos/play/wwdc2026/220/) | Current VoiceOver and alternative-input guidance for complex controls. |

## Firsthand pre-release observations — useful questions, limited validation

| Source | Distinct signal |
| --- | --- |
| [GQ: interview and extended hands-on](https://www.gq.com/story/iphone-duo-john-ternus) | Direct Apple design-team interview and a handedness observation. |
| [MacRumors: launch hands-on](https://www.macrumors.com/2026/09/09/iphone-duo-hands-on/) | Short encounter with fold visibility and UI adaptation. |
| [Android Central: hands-on](https://www.androidcentral.com/phones/apple-iphone/apple-iphone-duo-hands-on) | First-person inner-display and interface impressions; author notes testing limits. |
| [Tom's Guide: 30-minute hands-on](https://www.tomsguide.com/phones/iphones/i-spent-30-minutes-with-the-iphone-duo-3-things-you-just-dont-get-from-the-pictures) | Weight, matte display, and handling impressions from a brief session. |

## Comparative primary research — transferable, not Apple rules

| Source | Distinct signal |
| --- | --- |
| [Android: learn about foldables](https://developer.android.com/develop/adaptive-apps/guides/foldables/learn-about-foldables) | Continuity and tabletop/book posture design principles from another platform. |
| [Android: make your app fold aware](https://developer.android.com/develop/adaptive-apps/guides/foldables/make-your-app-fold-aware) | Fold/hinge occlusion and adaptive-window concepts. |
| [Foldable smartphone UX framework, 2025](https://ijietap.journals.publicknowledgeproject.org/index.php/ijie/article/view/10935) | Original research highlighting hinge, user ergonomics, and interface state. |
| [Mobile map apps on foldables, 2024](https://alexandria.unisg.ch/entities/publication/3c4f821c-54d7-4365-bf9a-cc91bde27dc1) | Nine-participant study of cross-display context and orientation in one task domain. |

## Unconfirmed developer reports to monitor

- [Safe area in Duo Split View](https://developer.apple.com/forums/thread/847149): community report and reply; no confirmed Apple resolution in the reviewed page.
- [Hinge listeners in a keyboard extension](https://developer.apple.com/forums/thread/847490): community beta report; no confirmed Apple resolution in the reviewed page.

These forum posts are leads for future verification. They are not platform rules or proof of shipping behavior.
