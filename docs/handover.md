# Handover — 2026-11-20

Live: https://chronology.abenaga.com/s/  (deploy verified, run success)
Branch `outstanding-work` merged to `main` at `e70ee39`.

## Suites (run these before and after anything)

    node verify.js            engine + CRUD + timeline geometry (COUNTS)
    node verify_position.js   POSITIONS: marks/crosshair inside the viewport
    node verify_browser.js    real-browser geometry, ruler alignment, Today
    node audit_ui.js          layout/clipping/contrast

verify.js PASSES WHILE THE PAGE IS VISIBLY BROKEN — it asserts counts, not
positions. verify_position.js is the one that catches this class of bug.
All four are green as of this commit; keep them that way.

## Where things stand

Shipped: geometry rework (one coordinate space), crosshair in viewport, bubbles
16px, ruler ticks, marks clamped to the column, zoom presets, all 12 months,
per-calendar validity bounds, calendar types (builtin/clone/custom), the ⚙
global settings panel, calendar ordering, settings persistence.

## OPEN: time direction (Future-on-top)

The checkbox is DISABLED in the ⚙ panel. State of the work:

- `day2px`/`px2day` are now ALWAYS positive; `DIRECTION` only inverts the
  painting (column bodies flipped with `scaleY(-1)` + `translateY(H)`).
  This is correct and measured — the old `DIRECTION * ...` returned negative
  offsets that the mark clamp discarded (0 marks, range read year 12015 BCE).
- What is MISSING: the mirrored `scrollTop`. `scrollForDay()` has a -1 branch
  but its sign is unverified. Symptom when flipped: the crosshair DAY is right
  and `scrollH` is right (218,009 both ways) but ZERO labels are in view,
  because `scrollTop` stays put while the painting mirrors.
- To finish: measure `(scrollTop, clientH, bodyH, day2px(day))` for both
  directions and solve for the scrollTop that puts a given day under the
  viewport centre. MEASURE, do not guess — four guessed formulas all failed.

Measurement harness pattern (see git history): open a tab on :9223, clear
localStorage on the app origin, navigate, then read the numbers.

## Next, in order

1. Finish the mirrored scroll; enable the checkbox.
2. Tick thickness is shared across tiers — the CSS var `--tick-minor-w` is used
   for every tier. Per-tier thickness needs a class-based rule.
3. Ruler as a TYPE + default-ruler initial state (docs/req-types-states-view.md).
4. Anchored/floating state + anchor model + floating 2-column layout (30+210).
5. Clone / custom-clone event inheritance.
6. Virtual scrolling (deferred by Abe; see docs/req-types-states-view.md for
   the ceiling maths: 2^24 px / DAYS_TOTAL).

## Gotchas that cost hours

- `#vt-scroll` is a scroll container, so an `absolute` child's `top` is in
  CONTENT coordinates — `scrollTop` belongs in it. This is why the crosshair
  read year 9035.
- The visible-window margin (400px) makes mark loops run past DAY_BOT; clamp
  marks to `bodyH()` or the column's scrollHeight grows and the scroll range
  runs past the data (year 2545 instead of 2028).
- `Settings.get()` returns a fresh merged copy. Mutating it does NOT persist —
  write to the store.
- `timeline.js` had no cache-buster for most of the session; tests and Abe were
  both seeing stale code. Every `cal/*.js` now has `?cb=`.
- Harnesses must clear localStorage on the APP origin, or probes leave
  calendars behind and results stop reproducing.
