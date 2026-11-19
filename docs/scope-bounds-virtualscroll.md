# Scope — unbounded calendars + virtual scrolling (2026-11-18)

Two requests, one root cause.

## The connection

Today `timeline.js` line 10:
    const MINY = -5000, MAXY = new Date().getFullYear() + 2;

That single pair is used for TWO different things:
  (a) the GLOBAL pixel range — the scroll extent, the zoom ceiling
  (b) each CALENDAR's validity window — where its ticks may be drawn

They are not the same thing, and conflating them is why:
  - the scroll height is `DAYS_TOTAL * PPD`, so the browser's 2^24 px cap
    silently caps the finest zoom at ~6.5 px/day
  - a calendar cannot be unbounded, or start-only, or end-only — every calendar
    inherits the same -5000..+2 window

Fix (a) with virtual scrolling and (b) falls out naturally, because the pixel
range stops being derived from a global year range.

## Part 1 — per-calendar validity (the model)

A calendar carries its own bounds, as DATA, not a global constant.

| kind | start | end | example |
|---|---|---|---|
| `unbounded` | none | none | Proleptic Gregorian, the ruler |
| `start-only` | yes | none | a calendar that begins with an epoch and runs forever |
| `end-only` | none | yes | (rare) |
| `bounded` | yes | yes | a state, a regime, a proposed calendar |

Bounds are expressed in the CALENDAR'S OWN units (y/m/d), because that is what
the owner knows. They convert to a day index via the calendar's own epoch.

Behaviour:
- outside its bounds a calendar still CONVERTS (the ruling: an anchor always
  exists) but renders nothing — no ticks, no events, no column content
- a column with no visible content in the current view must say so rather than
  look empty
- the ruler is `unbounded` by definition

Relationship to floating calendars (docs/floating-calendars.md):
  `assumed` = the anchor is present but not committed. That is ORTHOGONAL to
  bounds — a calendar can be assumed AND bounded. Keep the two axes separate.

## Part 2 — virtual scrolling (the engine)

Replace "one very tall content box" with "a bounded box showing a window".

Current:  #vt-inner height = DAYS_TOTAL * PPD        (up to 77M px -> clamped)
Proposed: #vt-inner height <= ~2 * MAX_SCROLL_PX, and we render an offset window.

Model:
  - a "spacer" element of height `W` (bounded, e.g. 8,000,000 px)
  - the visible window is `scrollTop + viewportH`, mapped into day space
  - marks/events are generated for that day window only (already the case)
  - day2px/px2day become LOCAL to the window:
        contentY = (day - windowStartDay) * PPD
    so a day is still exactly one height everywhere -> the shared-day invariant
    and the crosshair/ruler/event alignment all keep working
  - PPD is then unconstrained by range: 30 px/day works at ANY range

Consequences to handle:
  - scroll extent is a window, so "scroll to today" = re-centre the window,
    not jump scrollTop to 76M
  - the zoom ceiling disappears; MIN_PPD/MAX_PPD become usability limits only
  - the ruler and columns must share the same window (they already share marks)
  - fit-all still means "show the whole range" -> PPD = viewportH / DAYS_TOTAL

## What I need from Abe before building

1. **Scope order** — Part 1 first (per-calendar bounds), then Part 2 (virtual
   scrolling)? They are independent enough to ship separately, and Part 1 is
   much smaller. My recommendation: Part 1, verify, then Part 2.
2. **Bounds on BUILT-INS** — which built-ins are `unbounded` vs `bounded`?
   Gregorian/Julian are proleptic -> unbounded. Hijri (tabular) -> unbounded.
   Egyptian/Maya -> ? Need the list.
3. **What does a column show when it has no content in view?** A muted
   "outside range" message? Nothing? This is a visible change.
4. **Is `assumed` still orthogonal** — confirm a calendar can be assumed AND
   bounded, or whether assumed implies unbounded.

## Explicitly NOT in this scope

- The floating/assumed calendar UI (deferred; only the bounds axis is here)
- The global settings panel (batch5 section B) — still pending
- The direction toggle (batch5 section C) — still pending
