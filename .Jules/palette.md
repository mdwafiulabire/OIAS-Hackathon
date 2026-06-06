## 2025-02-12 - Improve accessibility of icon-only buttons
**Learning:** Found that multiple pages had icon-only buttons with either no screen-reader label or a generic "Actions" label. Adding specific labels using `sr-only` class greatly improves accessibility context.
**Action:** Always include contextual, descriptive visually-hidden text for all icon-only buttons.