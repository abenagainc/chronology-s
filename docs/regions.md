# Page regions — naming convention (for talking to the agent)

Agreed 2026-11-17. Abe refers to these by number; the agent must map them to the
DOM without asking again. **When reporting a change or a bug, cite the region
number** so Abe can say "row 2 is too tall" and be understood.

> **RENUMBERED 2026-11-17** — an events panel is being inserted between the
> calendar list and the timeline, so everything from the old region 3 onward
> shifts by one. Earlier notes that say "region 3" mean **region 4** now.

## Level 0 — the page (current)

| # | region | DOM | notes |
|---|--------|-----|-------|
| **0** | background | `body` | the outer canvas, darker than everything inside it |
| **1** | header bar | `.topbar` | brand "Chronology S", tabs (Timeline / Events), `dummy data` chip, **reset** |
| **2** | left column | `.side` | calendar list: show/hide checkbox, colour swatch, name, actions. Two sections (CALENDARS / CUSTOM), each with its own add button. **Collapsible — minimisable to give region 4 more room.** |
| **3** | events panel | *(new — to build)* | between region 2 and region 4. **Expandable and collapsible.** Holds the events list. |
| **4** | right column | `.main` | the timeline component and its controls |

### Old → new

| old | new | what |
|-----|-----|------|
| 2 | **2** | left column (unchanged) |
| — | **3** | events panel (new) |
| 3 | **4** | right column |

## Level 1 — the timeline component (inserted in region 4)

Called **"the timeline"** or **"row N"**.

| row | region | DOM | contents |
|-----|--------|-----|----------|
| **row 1** | coordinates | `.tl-range` | `viewing … → … · px/day · px/year` — slim, centred |
| **row 2** | the timeline | `#vt-scroll` | the ruler + one column per calendar |
| **row 3** | legend | `.legend` | ruler note, calendar swatches, "one day = one height" |

Controls (`.tl-controls`) sit **outside** the table, in-flow above it — not a row.

Row 2 is split into two named parts:

| part | DOM | notes |
|------|-----|-------|
| **the ruler** | `.ruler` | the left strip inside row 2. Carries the reference selector (`#refSel`) and the year labels. A reference frame, never a data column. |
| **a calendar column** | `.col` | one per calendar, **called by its own name** — "the Gregorian column", "the Hijri column", "the Julian column". Never "column 1/2/3". |

Two things live *over* row 2: the **crosshair** (`.cross`, pinned to the scroll
viewport) and the **hover readout** (`.readout`, fixed to the window).

## Where these live in code

- `index.html` — regions 1, 2, 4 and the timeline rows
- `cal/styles.css` — `.topbar`, `.side`, `.main`, `.tl-controls`, `.tl-range`,
  `#vt-scroll`, `.legend`
- `cal/timeline.js` — region 4, row 2 (and the crosshair overlay)
- `cal/sidebar.js` — region 2
- `cal/editor.js` — the drawer (overlays everything; not a region)
