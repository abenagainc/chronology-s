# Chronology Tool S

A visual tool for viewing **multiple calendars side by side on one shared day scale**,
running in the browser. Prototype phase: dummy data in `localStorage`, no backend.

## Run it

```bash
cd "/Users/abenagainc/Work/Chronology tool S"
./serve.sh                 # http://127.0.0.1:8012
```

Then open:

| page | what it does |
|---|---|
| `index.html` | vertical multi-calendar timeline |
| `calendars.html` | add / edit / delete calendars, incl. custom rule editor |
| `events.html` | add / edit / delete events, in any calendar |
| `checks.html` | conversion known-answer table (in-browser) |

Click **reset** in the top bar to restore the seed dummy data.

## Verify

```bash
node verify.js
```

Runs the real page scripts in a DOM and checks geometry + CRUD + conversions
against published reference values. Requires `jsdom` (`npm install jsdom`).

## The one rule everything rests on

**The day is the only unit shared between calendars.**

- Internal axis = integer day index, **day 0 = 1 Oct 2026 (Gregorian)** — the fixed anchor.
- Every calendar is a *rule set*: months, days-per-month, leap rule, epoch.
- Each calendar column positions itself with the same `day2px()` map, so the same
  day is always at the same height in every column. Columns cannot drift.
- Zoom changes `PPD` (pixels per **day**), never pixels-per-year — otherwise a day
  becomes sub-pixel and the daily anchoring silently breaks.

## Files

```
index.html        timeline page
calendars.html    calendar CRUD + rule editor
events.html       event CRUD
checks.html       known-answer conversion table
serve.sh          local dev server
verify.js         end-to-end checks (jsdom)
cal/engine.js     day math + built-in calendars + rule engine
cal/store.js      dummy-data store (localStorage) — the one DB seam
cal/timeline.js   vertical timeline renderer
cal/calendars.js  calendar CRUD UI
cal/events.js     event CRUD UI
cal/styles.css    shared styles
```

## Built-in vs custom calendars

Both are the same to the engine — a rule set. The difference is *where the rules live*:

| | built-in | custom |
|---|---|---|
| rules defined in | code (`engine.js`) | data (`localStorage`) |
| editable in UI | no (duplicate → edit the copy) | yes |
| epoch stated as | an absolute day number | a date in another calendar |
| adding one | write + test code | fill in the form |

`kind` is a label only; it changes no behaviour.

## Conventions & gotchas learned

- **Never build date strings from negative years.** All arithmetic is numeric on the
  day index; there are no `Date` objects and no parsed date strings anywhere.
- **A calendar's epoch must resolve to a finite day.** `calReady()` guards this and
  `safeFormatDay()` renders `—` rather than letting one broken calendar poison the
  whole view. A created calendar resolves its epoch to an absolute day *before*
  storing, so it stays self-contained.
- **Year marks need a label at every zoom.** Compute a year step from the pixel
  budget and label every Nth mark, or labels vanish entirely at fine zoom.
- **A sticky ruler/axis needs the same header height as the columns**, or its body
  starts higher and every label sits offset by exactly the header height.
- **The ruler is derived from the same `marksFor()` the Gregorian column uses** —
  not a separate loop. Two loops will diverge.
- **Tabular Hijri ≠ observed Hijri.** The arithmetic calendar runs ~2 months ahead
  of moon-sighted dates (1 Muharram 1446 AH = 23 Sep 2024 tabular vs 7 Jul 2024
  observed). Fine for a diagram; not a date anyone used.
- **Hijri epoch:** AH 1/1/1 = 16 July 622 CE **Julian** = 19 July 622 Gregorian.
  Same day, different numbering — Julian and Gregorian diverged by 3 days in 622.
- **Cache-bust the JS** (`?cb=N`) or the browser serves stale logic and you chase
  ghosts that aren't bugs.

## Known limits (prototype)

- Dummy data only; `Store` is the single seam to replace with a real DB.
- Gregorian-only year ruler (not switchable yet).
- No persistence of view state (zoom/scroll) across reloads.
- The tabular Hijri is a convention, flagged in the UI.
