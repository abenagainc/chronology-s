# Page regions — naming convention (for talking to the agent)

Agreed 2026-11-17. Abe refers to these by number; the agent must map them to the
DOM without asking again. **When reporting a change or a bug, cite the region
number** so Abe can say "row 2 is too tall" and be understood.

## Level 0 — the page

| # | region | DOM | notes |
|---|--------|-----|-------|
| **0** | background | `body` | the outer canvas, darker than everything inside it |
| **1** | header bar | `.topbar` | brand "Chronology S", tabs (Timeline / Events), `dummy data` chip, **reset** |
| **2** | left column | `.side` | calendar list: show/hide checkbox, name + subtitle, hover edit/duplicate/delete, `＋ Add calendar`, then the `VIEW` block |
| **3** | right column | `.main` | everything on the right |

## Level 1 — the timeline component (inserted in region 3)

The timeline is a component with its own rows. Called **"the timeline"** or
**"row N"**.

| row | region | DOM | contents |
|-----|--------|-----|----------|
| **row 1** | controls | `.tl-tools` | `＋ －` \| `← calendars →` \| `↑ ↓ [Years] Today` |
| **row 2** | viewing coordinates | `.tl-range` | `viewing … → … · px/day · px/year` — slim, centred |
| **row 3** | timeline | `#vt-scroll` | year ruler + one column per calendar, scrolls |
| **row 4** | legend | `.legend` | ruler note, calendar swatches, "one day = one height" |

Row 3 is split into two named parts:

| part | DOM | notes |
|------|-----|-------|
| **the ruler** | `.ruler` | the left strip inside row 3 holding the Gregorian year labels. Always Gregorian (reference). Pinned left while the columns scroll horizontally. |
| **a calendar column** | `.col` | one per calendar, **called by its own name** — "the Gregorian column", "the Hijri column", "the Julian column". Never "column 1/2/3". |

So row 3 = the ruler + N calendar columns. Saying "the Hijri column" means that
calendar's `.col`; saying "the ruler" means `.ruler`.

Two things that live *over* row 3 (not parts of it): the **crosshair** (`.cross`,
pinned to the scroll viewport) and the **hover readout** (`.readout`, fixed to the
window). Refer to them by those names.

## Confirmed

Abe's slip ("3 is the column on the left, sorry, 2 …") was corrected and
confirmed: **2 = left column, 3 = right column.**

## Where these live in code

- `index.html` — regions 1, 2, 3 and the timeline rows
- `cal/styles.css` — `.topbar`, `.side`, `.main`, `.tl-panel`, `.tl-tools`,
  `.tl-range`, `#vt-scroll`, `.legend`
- `cal/timeline.js` — row 3 (and the crosshair overlay inside it)
- `cal/sidebar.js` — region 2
- `cal/editor.js` — the drawer (overlays everything; not a region)
