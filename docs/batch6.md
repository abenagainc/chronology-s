# Batch 6 — fixes + pending (2026-11-19)

## A. Two live bugs (reported by Abe)

### A1. Bounds are NOT editable for built-in calendars

`cal/sidebar.js` gives built-ins only a `✎` that opens the COLOUR/FORMAT popover
(`openCalPop`), never the rule editor. The editor has no built-in gating, so it
would work — the entry point is simply missing.

Fix: give built-ins the same edit entry point as customs. Open the full editor
(`CalEditor.open(c)`) for built-ins too. The editor already handles any calendar
object; the only difference is that saving must UPDATE the stored copy rather
than create a new one.

### A2. Everything starts at 5000 BCE and ends at 2028

`cal/timeline.js` line 10:
    const MINY = -5000, MAXY = new Date().getFullYear() + 2;

This pair is used for BOTH the pixel range (scroll extent / zoom ceiling) and
each calendar's validity window. That conflation is the root of several problems
(see docs/scope-bounds-virtualscroll.md).

Abe: "lets clear those and start with the pending issues."

Decision needed (ask before building):
- What should the default range be? (e.g. 3000 BCE – 500 CE? 1 CE – today?)
- Should the range become a SETTING?
- Should the RULER be unbounded while calendar columns are bounded?

## B. Pending

| item | state |
|---|---|
| B1. Global settings panel (⚙) replacing ☰ ticks | spec'd, not started |
| B2. Direction toggle | `DIRECTION` constant only, no UI |
| B3. Virtual scrolling (Part 2) | needed for day labels at 30 px |
| B4. Floating / assumed calendars | docs only |
| B5. Data storage / seed updating | raised, unscoped |
