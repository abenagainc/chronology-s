# ARCHITECTURE RULING — four separate concerns (Abe, 2026-11-19)

Status: **ruling, not yet built.** This is the model to implement.

## The problem

Today ONE object holds everything:

    { id, name, kind, color, era, format, boundFrom, boundTo,
      months, leapMonths, leap, epoch, epochDay }

and `MINY`/`MAXY` in timeline.js acts as a global range that is ALSO treated as
each calendar's validity window. So:
  - proleptic calendars cannot be unbounded (the system is bounded by one pair)
  - a calendar's rule and its display colour live in the same place
  - the ruler inherits a range it should not have
  - "clear those" is impossible without touching code

## The four concerns

### 1. CALENDAR RULES — in code, per calendar system
What makes a calendar *that* calendar: months, month lengths, leap rule, epoch
definition, era convention.
    Stored: in code, in each individual calendar system (gregorianCal(), ...).
    Edited: never in the UI. Built-ins are immutable here.
    A custom calendar PARALLELS these with its own data variables.

### 2. CALENDAR DATA VARIABLES — per calendar instance, in the store
An instance's own values, in its OWN units:
    epoch date, month names/lengths, leap config, era labels, format
    (for a custom calendar these ARE the rules; for a built-in they are
     overrides/parallels of the code rules)
    Stored: store, per calendar.

### 3. CALENDAR VIEW VARIABLES — per calendar instance, in the store
How a calendar is SHOWN, all calendars, edited in the calendar editor:
    name, colour, hidden, format display, bounds (valid from / valid to)
    Stored: store, per calendar.

### 4. TIMELINE VIEW VARIABLES — global, in the store
How the TIMELINE is shown, edited in GLOBAL SETTINGS:
    range (min/max), zoom/PPD, direction, calendar width, tick thresholds,
    tick colours/thickness, label sizes
    Stored: store, global (the existing `ui` slot).

## The key separation

| | where | edited by |
|---|---|---|
| calendar rules | code | never |
| calendar data vars | store, per calendar | calendar editor |
| calendar view vars | store, per calendar | calendar editor |
| timeline view vars | store, global | global settings |

## Boundaries

- **Proleptic calendars are unbounded BY DESIGN.** The system must be able to
  exist unbounded; bounds are an optional property of an instance.
- Another calendar may have a start, an end, both, or NEITHER.
- **Floating boundaries** = a bound that is ASSUMED, not committed (same shape as
  floating calendars). Distinct from "no bound".
- Until VIRTUAL SCROLLING lands, an unbounded ruler cannot be shown — the pixel
  range caps it. So bounds stay as they are for now; the model above is the
  target, not the current state.

## Consequence for the range

`MINY`/`MAXY` is a TIMELINE VIEW VARIABLE, not a calendar property. It should
move out of code into global settings. Calendar bounds are per-instance and
independent of it.

## Open questions for Abe

1. Does a built-in's VIEW editable include its DATA variables (epoch, month
   names) or only view (colour/format/bounds)? Earlier ruling: built-ins are
   immutable in rules, editable in colour/format. Where do epoch/months sit?
2. Custom calendars: are their data variables the SAME fields a built-in's rules
   use (so a custom calendar "parallels" a built-in)? Confirm.
3. Global settings: should the timeline range be there, or is range a
   navigation control rather than a setting?
