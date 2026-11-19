# Built-ins, duplication, and the timeline range — ruling (2026-11-19)

Abe's answers, restated. Supersedes parts of architecture-four-concerns.md.

## 1. Built-in calendars can be bounded OR unbounded

There is no rule "built-ins are unbounded". Each built-in system declares its
own bounds:

| system | bounds |
|---|---|
| Proleptic Julian | unbounded |
| Julian (historical) | **bounded** — started at a specific date |
| Proleptic Gregorian | unbounded |
| Gregorian (historical) | bounded (1582) |
| Proleptic Hijri (tabular) | unbounded |
| Hijri (observed/historical) | bounded |

So "Proleptic X" and "X" are DIFFERENT built-in systems, with different bounds.
Bounds live with the SYSTEM (in code), not with the instance.

## 2. Built-in instances are display-only editable

For ANY built-in, the owner can edit ONLY:
  - colour
  - date format

Everything else — months, leap rule, epoch, era convention, bounds — is frozen.
Per-calendar, not global.

(So "calendar view variables" for a built-in = {colour, format}. A custom
calendar additionally exposes its data variables.)

## 3. Duplication: two explicit choices

Duplicating a built-in must offer:
  (a) **keep all system settings the same** — a display copy
  (b) **adjust variables** — becomes a custom calendar

And in case (b) the owner must be able to SEE every adjustable variable, not a
subset. So the custom editor shows the full parallel: months, month lengths,
leap rule, epoch, era, bounds.

## 4. The timeline range is DERIVED, not a setting

The timeline must handle whatever calendars are in it.

- If any PROLEPTIC (unbounded) calendar is shown -> the timeline must scroll
  unbounded. **Not possible until virtual scrolling.**
- If NO unbounded calendar is shown -> the range is derived from the content:
  the earliest start among shown calendars, the latest of (end, latest event,
  today).

So there is NO global `MINY`/`MAXY` constant. The range is computed from the
shown calendars + events + today.

## Decision: OPTION 2 (2026-11-19)

Built-in systems + display-only editing + duplication choices now.
**The span stays exactly as it is** (`MINY = -5000, MAXY = today+2`) — do NOT
change the range until virtual scrolling lands. Changing it risks breaking
other things for no gain while the range is still a hard constant.

So for now:
- bounds remain a property built-ins do not expose in the UI
- the range remains the existing constant
- the DERIVED range is deferred to the virtual-scrolling work

## Consequences

- `MINY = -5000, MAXY = today+2` must go. It is not a setting.
- The derived range needs a FALLBACK while virtual scrolling is pending: with an
  unbounded calendar present we cannot scroll unbounded, so we need an explicit
  interim behaviour (e.g. a large finite window) — to be decided.
- Bounds are a property of the built-in SYSTEM (code) and of custom calendars
  (data). Proleptic vs historical are separate systems.

## Open

- Interim behaviour until virtual scrolling: finite window around today? How
  large? Or hide unbounded calendars from the scroll extent and warn?
- Does "latest event" mean across ALL calendars or only shown ones?
