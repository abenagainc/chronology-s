# Batch 5 — geometry rework + global settings + direction toggle

Approved 2026-11-18. Branch: **`geometry-rework`**.

## Why

The timeline's geometry accumulated compensating patches. `bodyOffset()` returns
a value in SCROLL-CONTENT coordinates but ~10 call sites treat it as VIEWPORT, so
every conversion is off by a scroll position. Symptoms (all confirmed live):

- crosshair bubbles: element exists but is **218,009px tall**, sticky, spanning
  the columns — the "ruler-like bar that scrolls"
- ticks: **0 marks in viewport** though 80 exist — the visible window is computed
  with the wrong offset, so marks are generated off-screen; they appear and
  disappear while scrolling
- ruler: **0 tick lines**, only labels
- zoom: density changes but placement does not

## A. Geometry rework

1. **One coordinate space.** Everything in CONTENT coordinates; convert to
   VIEWPORT only at the final step for the crosshair/readout. `bodyOffset()` is
   deleted — no call site subtracts it.
2. **One visible-window function** returning `{lo, hi}` in day indices; every
   mark generator uses it.
3. **Explicit element ownership.** Each overlay declares its space; CSS pins its
   height so nothing can become 218,000px again.
4. **Ruler uses the same mark set as the columns** (ticks included, not labels only).
5. **Direction is one constant** threaded through `day2px`/`px2day`.
6. **Geometry self-check asserts POSITION WITHIN THE VIEWPORT**, not existence.
   This is the gap that let all of the above through.

## B. Global settings (replaces the ☰ ticks popover)

Entry: a **⚙ settings** control. **All values editable** and persisted.

- **Calendar width: 210 px** — every column identical; **ruler exempt**
- minor tick only — shown when `5 px ≤ unit < 30 px`
  - colour dark grey, thickness 1 px
- major tick + label — shown when `unit ≥ 30 px`
  - colour light grey, thickness 2 px

Per tick type — size and content:

| type | size | content |
|---|---|---|
| Millennium | Large | year number (`5001 BCE`) |
| Century | Medium | year number |
| Decade | small | year number |
| Year | small | year number |
| Month | small | month name |
| Day | small | day number |

Sizes default **Large 12 / Medium 10.5 / small 9 px**.

**Everything else goes:** the density slider, the labels slider, label size
select, per-tier threshold inputs — all replaced by the above. Only what is
listed here remains.

## C. Direction toggle

Flip the whole timeline (ruler + all columns) between past-on-top and
future-on-top, via the single `DIRECTION` constant.

## Verify

`./check.sh`, `node audit_ui.js`, real-browser geometry — including **marks
inside the viewport** and **bubble height < 40px**, which were never asserted.
Check the LIVE site, not only local.

## CHECKPOINT 1 — committed 2026-11-18 (branch `geometry-rework`)

Landed and verified:
- `bodyOffset()` deleted; ONE coordinate space (`contentToView`/`viewToContent`)
- crosshair: was 217,728px (off-screen) → 482px, inside the viewport
- crosshair bubbles: were 218,009px tall (a band) → 16px, on the line
- ruler: was 0 tick lines → 66 ticks + 37 labels, same mark set as columns
- marks: were generated for the wrong window (0 in view) → 123–160 in view at
  every scroll position; they regenerate on scroll
- `timeline.js` given a cache-buster (it had none — stale code was being tested)
- root cause of "no ticks": `MAXY_DATA = ceil(DAY_BOT/365.2425)` treated a day
  INDEX (822) as a year → 3, so `yEnd < yStart` and the loop never ran

KNOWN BROKEN, deliberately not fixed here:
- **zoom presets / Today do not reliably change scrollTop.** `render()` rebuilds
  `#vt-inner`, and the scroll handler re-renders, which resets scrollTop to 0.
  A SELF_SCROLL guard was tried and made things worse (absurd years, 0 marks),
  so it was reverted. Needs the position-based test below before another attempt.

## NEXT (b): build the position-based test FIRST

`verify.js` passes while the page is visibly wrong — it asserts COUNTS, not
POSITIONS. Before touching the presets, add assertions that fail when the UI is
broken:
- `#range` shows a sane year (e.g. |year| < 10000)
- some `.col-body .mark` is inside the viewport rect
- `#cross` top is within the viewport
- `#crossBubbles` height < 40px
- after Today: scrollTop > 0 and the view includes the current year

Then fix the presets against those assertions.

## Scope

~250 of 576 lines in `cal/timeline.js`, overlay CSS, the settings panel.
Estimate 2–3 hours. Mid-way checkpoint after A (space unification) so Abe can
look before the toggle and settings land.

## Out of scope (still parked)

- Custom-calendar tick model (`customMarks()` seam exists, behaviour undecided)
- Floating/assumed calendars (`docs/floating-calendars.md`, fully specified)
- Built-in preset list (Coptic, Ethiopic, Persian …)
