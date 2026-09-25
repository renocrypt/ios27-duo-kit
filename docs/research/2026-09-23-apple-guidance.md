# Apple guidance for iPhone Duo

Checked: September 23, 2026.

## Answer

**Yes.** Apple published a dedicated *Designing for iPhone Duo* page in its Human Interface Guidelines (HIG) on September 9, 2026. Apple also provides a Duo developer hub, a design video, and design resources. Liquid Glass guidance is published in the HIG's general Materials page. Treat the Duo layout guidance and the Liquid Glass material guidance as complementary; the pages reviewed do not present a separate Duo-only Liquid Glass specification.

Apple's term is **Human Interface Guidelines (HIG)**, rather than “HMI guide.”

## Primary sources

| Source | Use |
| --- | --- |
| [Designing for iPhone Duo — HIG](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo) | Device anatomy, poses, best practices, dynamic layouts, reserved regions, and vertical controls. The page's change log dates it September 9, 2026. |
| [Get ready for iPhone Duo](https://developer.apple.com/iphone-duo/) | Apple's index of Duo videos, documentation, tools, and design resources. |
| [Design for iPhone Duo — video](https://developer.apple.com/videos/play/tech-talks/111466/) | Apple design team's demonstration of control placement, resizing, sheets, and fold avoidance. |
| [Materials — HIG](https://developer.apple.com/design/human-interface-guidelines/materials) | Liquid Glass usage and its relationship to content and controls. |
| [Apple Design Resources](https://developer.apple.com/design/resources/) | Current UI kits and iPhone Duo product bezels. |
| [Apple unveils iPhone Duo](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/) | Official product announcement and device context. |

## Design context from Apple's guidance

- **Adapt across displays and poses.** Use compact-width and regular-width size classes for the outer and inner displays. Build layouts that resize using margins and safe area insets; avoid fixed widths tied to a particular display.
- **Preserve continuity.** Keep features, control access, state, and the information hierarchy consistent as the device opens, closes, or changes pose. The inner display can reveal more of the same hierarchy.
- **Respect reserved regions.** The outer camera, active inner camera, and conditional fold region affect available space. Standard components such as sheets, alerts, menus, and split views adapt automatically. Custom components may need the Reserved Region APIs.
- **Follow vertical controls.** Toolbars, tab bars, and navigation controls move to the side on the outer display and on the inner display in landscape. The inner display in portrait keeps horizontal bars. Use system placement and overflow behavior where possible.
- **Use Liquid Glass for its intended layer.** Apple's Materials guidance puts it on controls and navigation above content, recommends standard materials in the content layer, and advises sparing use on custom controls. This is general Apple platform guidance applied alongside the Duo-specific HIG.

These points are a working summary, not a replacement for the linked Apple pages. Recheck the live guidance before implementing a specific design, because the HIG can change.
