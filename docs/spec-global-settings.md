# Global settings panel (⚙) — spec (2026-11-19)

Replaces the ☰ ticks popover. Entry: ⚙ next to Today. Everything editable and
PERSISTED (store `ui`).

## Settings

| setting | default | notes |
|---|---|---|
| calendar width | 210 px | all columns equal; ruler exempt |
| ruler width | 78 px | editable (kept 78 as the default) |
| minor tick limit | >= 5 px, < 30 px | below 5 = hidden |
| minor tick colour | dark grey | |
| minor tick thickness | 1 px | |
| major tick limit | >= 30 px | |
| major tick colour | light grey | |
| major tick thickness | 2 px | |

## Per time unit

Each unit has a FONT SIZE and a FORMAT, both editable.

| unit | default size | format options |
|---|---|---|
| Millennium | Large | YYYY |
| Century | Medium | YYYY |
| Decade | Small | YYYY |
| Year | Small | YYYY |
| Month | Small | **MM or month name** — per-unit choice; the month NAMES live in the calendar |
| Day | Small | DD |

Sizes are editable (px); Large/Medium/Small are just starting values
(12 / 10.5 / 9).

## Calendar ordering

TWO ways, both:
1. drag to reorder in the sidebar
2. an ordered list in the global settings panel

Both operate on the same order.

## Also in the panel (from the types/states requirement)

- magnification
- time units
- labels
- tick marks
- calendar ordering

## Implementation notes

- store `ui` already exists (`Store.load().ui`) — persist there.
- the panel must not be a `prompt()`; build it like the existing popovers.
- removing the ☰ ticks popover means its current contents (show labels,
  hide-below, label-from, finest scale) move here.
