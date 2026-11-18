# Batch 2 — pending (do not start until Abe says go)

Scoped 2026-11-17. Small, UI-only. Nothing here is executed yet.

## 1. Region 2 — colour control becomes the indicator  ✅ decided (b)

Today: a `<button>` containing a `●` glyph, plus a separate colour **dot** before
the name. Two indicators, and the button is a text glyph, not a colour control.

Change to: **one `<input type="color">`**, styled as an 18×18 rounded swatch,
sitting in `.acts` where the button was. It shows the calendar's colour and
opens the native picker. **Drop the separate dot** — the input is the single
indicator, and the row gets shorter.

## 2. Region 2 — replace `prompt()` for adding a built-in

Today `pickPreset()` uses `prompt()` with a numbered list. Crude.

Change to: a small **popover/dropdown** listing the presets by name, same
pattern as the `☰ ticks` popover. Selecting one adds it as a built-in.

## 3. Open: which presets to offer?

Code has: Gregorian, Julian, Hijri (tabular), Egyptian civil, Maya Haab, Blank.
Proposed first set: **Gregorian, Julian, Hijri (tabular), Coptic, Ethiopian,
Persian, Egyptian + Blank** (drops Maya Haab). Not decided. Abe noted we will
keep adding built-ins over time — treat the list as open-ended.

## 4. BUG: tick marks are invisible — ticks render as 0px transparent lines

Confirmed in the real browser: `.mark` elements have `height: 0px` and
`background: transparent`. Only the **labels** show — which is exactly what Abe
sees ("no months or even horizontal lines, I just see the years").

Cause: CSS defines `.mark.year`, `.mark.dec`, `.mark.month`, `.mark.day`, but
`builtinMarks()` emits the TIER name as the class — so at this zoom the class is
`mark millennium`, which matches **no** rule and falls back to `.mark`
(transparent, no height).

Fix: style `.mark` by tier **and** keep a visible default, e.g.
`.mark { height:1px; background:#3a3f3a; opacity:.6 }` plus
`.mark.millennium/.mark.century/.mark.decade/.mark.year { … }`.
Also check `.mark.decade` vs the tier name `decade`.

Secondary: at the default zoom only ~16 marks exist (one per ~1000 years,
`millennium` tier), so even fixed they'd be sparse. Check `pickTier()` —
`MIN_PX = 80` with `PPD ≈ 0.006` means a tier must be ≥ 80/0.006 ≈ 13,300 days
apart, so `millennium` (365,242 days) is the only tier that fits. The budget
is far too large; either lower `MIN_PX` or make the tier choice independent of
the label budget.

## 5b. BUG: hide checkbox does not hide the column

Confirmed in the browser: clicking the checkbox updates localStorage
(`["gregorian"]`), flips `aria-checked`, and `window.calVisible()` correctly
returns only the Hijri calendar — **but `.col` count stays at 2**. The sidebar
and the filter work; the TIMELINE DOES NOT REDRAW.

Cause: `sidebar.js` and `timeline.js` each keep their own module-scope `S`, and
the visibility state lives in localStorage read through two different closures.
`timeline.js` listens for `cal-visibility` and calls its own `render()`, but the
event is dispatched from inside the sidebar's `render()` path — order/staleness
between the two module states. Fix with ONE source of truth (a shared
visibility getter, or have the sidebar call into a single render function)
rather than patching the ordering again.

## 5c. BUG: built-in date format is unreachable

The row's actions for built-ins are colour + duplicate only. `format` lives on
the calendar object and is editable in the drawer — but built-ins cannot open
the drawer (no edit button, by design). So `format` is uneditable for built-ins.

Fix: add a small format control to the built-in row (a button showing the
current format, e.g. `DD/MM/YYYY`, opening a prompt or cycling presets) —
consistent with "hide, colour, format editable".

## 6. BUG (reported): ruler content stops short of the columns

Measured: ruler body 15,463.8px and column body 15,463.8px — identical boxes,
both heads 46px. But the ruler's LAST label is at `top:15400px` while the
columns' last mark is at `16636px`. The ruler looks shorter because its CONTENT
stops ~1200px early: `rulerMarks()` filters to `m.major && m.label`, and the label
budget suppresses the tail. Fix: give the ruler the same mark extent as the
columns and only suppress the TEXT, not the tick.

## 7. BUG (reported): cannot scroll far enough for the crosshair to reach the end

Measured: `scrollHeight 16689`, `clientHeight 414`, `maxScrollTop 16275`. The
last column mark is at 16636px and the body ends at 15464px. At max scroll the
viewport shows 16275→16689, so the bottom ~225px of content is unreachable, and
the crosshair is pinned to the viewport centre — it can never get there.

Cause: scroll extent is `bodyH() = DAYS_TOTAL * PPD`, which counts the day range
only. The 46px column headers sit OUTSIDE the body and are not counted, and the
last mark extends past the body. Fix: scroll extent = header + body, defined in
one place. This is the THIRD header-offset bug — settle the model once.

## 8. Region 1 — "Calendar" title is duplicated

Abe: "the title calander is duplicated." Likely the sidebar `<p class="label">Calendars</p>`
plus the new `CALENDARS` section header rendering the same word twice. Check
`index.html` vs `sidebar.js` `section('Calendars', …)` and remove one.

## 6. Deferred (not this batch)

- Custom-calendar tick model — seam exists (`customMarks()`), behaviour still
  matches built-ins. Abe has not decided what custom ticks should do.
- Superseded items from earlier notes.

## Notes for implementation

- `cal/sidebar.js` holds the row template and both `prompt()`s.
- `cal/editor.js` also has a colour field — leave it; it is the rule editor.
- Verify with `./check.sh` (engine+CRUD, UI audit, real geometry) then deploy.
