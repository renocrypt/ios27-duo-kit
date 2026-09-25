# Duo design system — research brief

Status: proposal, version 0.1. Researched September 23, 2026. This is a foundation for designing iPhone Duo experiences, not an Apple-authored specification or a finished component library.

## Finding

**Yes, a Duo-centered design system is feasible.** The strongest foundation is an *adaptive system of behaviors*: one experience that preserves purpose and state while its layout responds to available space, the fold, cameras, side-mounted controls, and accessibility settings. Apple's dedicated [Duo HIG](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) and [Duo developer hub](https://developer.apple.com/iphone-duo/) now provide enough official guidance to define those rules. Apple's [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials) provides the Liquid Glass layer.

The distinguishing quality should come from the app's content, typography, imagery, and careful use of color. A blanket glass treatment would work against Apple's guidance, which reserves Liquid Glass primarily for navigation and controls.

## What the latest Apple guidance enables

| Verified Apple guidance or tool | Design-system consequence |
| --- | --- |
| [Duo HIG](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo): compact-width outer display, regular-width inner display, resizable layouts, safe areas, and reserved regions | Define layout rules by available space and active regions. Do not define a separate static screen for every device pose. |
| [Adaptive layouts Tech Talk](https://developer.apple.com/videos/play/tech-talks/111463/): division regions for the fold, occlusion regions for cameras, and split/overlay arrangements | Let system containers handle common cases. Move only important custom content or controls when a reserved region requires it. |
| [Vertical bars Tech Talk](https://developer.apple.com/videos/play/tech-talks/111462/): system bars move to a side edge and adapt their overflow | Define action importance and grouping once; allow native bars to place controls for each context. |
| [Materials HIG](https://developer.apple.com/design/human-interface-guidelines/materials): Liquid Glass for the control/navigation layer, standard materials for the content layer | Treat material as a semantic role, not a fixed blur or opacity value. |
| [Apple Design Resources](https://developer.apple.com/design/resources/) and [September 18 developer update](https://developer.apple.com/news/?id=nyuppv9r) | Apple now offers Duo design kits for Figma and Sketch and Xcode 27.1 beta for testing. |
| [SwiftUI updates](https://developer.apple.com/documentation/Updates/SwiftUI) and [Duo preparation talk](https://developer.apple.com/videos/play/tech-talks/111461/) | `ArrangementView`, `ReservedRegion`, and vertical toolbar controls are available for exploration in the iOS 27.1 beta SDK. Their API details may change before final release. |
| [Multiple displays and scenes Tech Talk](https://developer.apple.com/videos/play/tech-talks/111464/) | Use region and arrangement APIs for layout. Reserve hinge-angle input for a purposeful interaction. Multiple app scenes are possible on Duo, while creating a new window is available only on the inner display. |

## Proposed system architecture

### 1. Foundations: semantic decisions

Define roles for text, color, surfaces, materials, spacing, shape, symbols, and motion. Use Apple system typography, Dynamic Type, semantic colors, SF Symbols, and platform components as the base. Our tokens should say **what an element does** (`primaryAction`, `contentSurface`, `secondaryText`, `navigationMaterial`) rather than lock in one pixel size, glass opacity, or device width. Record contrast and reduced-transparency behavior with each material role. This follows the [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Color](https://developer.apple.com/design/human-interface-guidelines/color), and [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) guidance.

### 2. Layout grammar: one task, several spaces

- **Compact width:** show the primary task in a focused, single-pane layout. Preserve access to all functions.
- **Regular width:** reveal supporting context such as a list/detail pair, secondary panel, or transcript where it improves the task. Do not merely stretch the compact composition.
- **Partially folded:** keep important text and interactive elements clear of the center curve. A split or overlay arrangement can place related views into the usable regions. Scrollable content can pass through the fold when appropriate.
- **Constrained scene:** allow Split View multitasking, picture-in-picture, keyboard, and overflow to change available space without losing the current selection or work.
- **Multiple scenes:** if the product supports more than one window, make window actions conditional on availability and keep each scene's state understandable.

Use size classes, margins, and safe area insets first. Use reserved-region queries for custom layouts that need them. Apple advises against fixed display-specific widths in the [Duo HIG](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) and explains the [region APIs](https://developer.apple.com/videos/play/tech-talks/111463/).

### 3. Navigation and control grammar

Prefer `NavigationStack`/`NavigationSplitView`, `TabView`, native toolbars, sheets, menus, and alerts. Specify each action's importance, grouping, title, and symbol. Let the system place bars vertically on the outer display and inner landscape, and horizontally on inner portrait; use its overflow menu when space is tight. Keep task-critical actions visible longer than secondary actions. Custom controls need a reason to exist and must adapt to the bar's axis. These rules derive from the [Duo HIG](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) and [vertical bars talk](https://developer.apple.com/videos/play/tech-talks/111462/).

### 4. Material and motion grammar

Use Liquid Glass for navigation and important controls above content. Use standard materials or solid content surfaces below them. For custom glass, choose a variant based on background legibility and test it under Reduce Transparency and Increase Contrast. Keep transitions tied to state changes, such as opening the device, revealing detail, or moving a control out of the fold; support Reduce Motion. Apple's [Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion), and [accessibility-testing guidance](https://developer.apple.com/documentation/accessibility/testing-system-accessibility-features-in-your-app) inform this proposal.

### 5. Accessibility is part of each component

Every component should specify its visual state and its accessible purpose, value, actions, and feedback. Test Dynamic Type, VoiceOver, Switch Control, Voice Control, RTL, increased contrast, reduced transparency, and reduced motion across layouts. Apple's [WWDC26 custom-controls session](https://developer.apple.com/videos/play/wwdc2026/220/) provides current guidance for complex controls.

## First component set to design

1. **Adaptive app shell:** navigation hierarchy, bars, safe-area behavior, and scene resizing.
2. **List/detail composition:** compact single pane and regular-width paired panes, with persistent selection.
3. **Primary action and toolbar groups:** semantic priority, symbols/titles, vertical placement, and overflow.
4. **Media or document workspace:** content plus contextual controls, including an optional split/overlay arrangement.
5. **Presentation states:** sheet, menu, alert, loading, empty, and error states that remain usable near the fold.

Each component should have anatomy, behavior, accessibility, content rules, implementation mapping, and examples in more than one layout. The design system should document when to use a system component instead of creating a new one.

## Proof before calling it ready

Build one representative journey (for example, browse → inspect → act) in the official design kit, then test a native prototype in Xcode's Duo simulator/Device Hub. Cover outer portrait and landscape; inner landscape and portrait; partially folded book and tabletop poses; Split View and picture-in-picture; keyboard visible; light and dark appearances; RTL; Dynamic Type; Reduce Transparency; Increase Contrast; Reduce Motion; VoiceOver; and opening/closing while editing. Test multiple-window availability if the product uses it. Check both visual clarity and task continuity. Apple's [Duo design video](https://developer.apple.com/videos/play/tech-talks/111466/), [preparation talk](https://developer.apple.com/videos/play/tech-talks/111461/), and [scenes talk](https://developer.apple.com/videos/play/tech-talks/111464/) show why these configurations matter.

**Update, September 23:** the product scenario is decided. It is a concept prototype of a personal hub; see the [hub concept brief](../hub.md). Because it is a concept, it may depart from the native-component rules above where the brief marks a departure.

The next design decision was the **product scenario** this system should serve. That will determine which content patterns and component examples deserve the first prototype. This brief establishes the shared rules so those examples can be built without inventing a different interface for each pose.
