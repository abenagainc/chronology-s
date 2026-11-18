# Batch 4 — FINAL SPEC (confirmed 2026-11-18)

Nothing here is optional; all confirmed by Abe.

## 1. Region 1
Remove the clock icon next to "Chronology S".

## 2. Rails
Labels "Calendars" / "Events" must sit INSIDE their bars. (Cause: `.rail-lab`
is `position:absolute` with no positioned ancestor, so it escapes.)
Also DELETE `calendars.html` and `events.html` and remove their links from
region 1. The drawers are enough; Abe wants more features in the drawers rather
than separate pages. The event drawer is drag-resizable (already is).

## 3. Region 4 controls
Equal space above and below the controls. (`padding: 14px 16px 12px` → symmetric.)

## 4. Row 3
Remove the legend contents; row 3 becomes the COORDINATES row. Keep the calendar
colour dots. (The dots live in the region-2 list already; row 3 keeps its own
compact dots for alignment reference.)

## 5. Two coordinate readouts (was one)
Today one bottom bubble serves both cursor and crosshair and they disagree.

- **Crosshair readout** — a bubble/label ON the crosshair line, one date per
  VISIBLE calendar (N calendars, not hardcoded 3), each positioned over its own
  column. Shows the CROSSHAIR's day.
- **Cursor readout** — in row 3, at the same horizontal positions as the bubbles,
  showing the MOUSE's day.
- The crosshair must NOT disappear when the mouse leaves the timeline.
- **The RULER gets a date too** — rendered as BOLD TEXT inside the ruler at the
  crosshair's height, NOT as a bubble.
- Do NOT change the crosshair's span/geometry. Aesthetics later.

## 6. Events drawer
Add an **"add event" button** pinned at the bottom of the panel — it must not
scroll with the list.

## 7. Era abbreviations per calendar
A calendar must be able to name both sides of its epoch. Hijri must read
**BH / AH**, not BCE/CE. Today `formatDay()` hardcodes `' BCE'` for `era:'ce'`.
→ add `eraBefore` / `eraAfter` per calendar; the format popover edits them.
Defaults: CE calendars `BCE`/`CE`, Hijri `BH`/`AH`.

## 8. Ruler scrolls away while columns stay
Ruler is sticky in X but its background/labels end early — it looks like it
disappears while a column remains. Investigate after the scroll-extent change;
make the ruler's painted height equal the columns'.

## 9. Tick tiers with editable boundaries in the popover
Replace the vague density behaviour with explicit zoom thresholds. Each tier
appears when the visible span is below a limit; editable IN THE POPOVER:

  days < 2 years · months < 10 · years < 150 · decades < 1500 ·
  centuries < 10000 · millennia beyond

Order (finest → coarsest): day, month, year, decade, century, millennium.
The density/label sliders then ADD ticks on top of that default.
Show which tier is active at the current zoom so we can tune it live.

## 10. Time-direction toggle — DEFERRED (Abe, 2026-11-18)

Abe: *"I'll leave it for now if leaving it doesn't make it a bigger problem later."*
**It does not.** Reason, verified by reading the code:

Every direction assumption flows through exactly two functions —
`day2px = day => (day - DAY_TOP) * PPD` and `px2day = px => DAY_TOP + px / PPD`.
Ticks, events, the crosshair and the scroll-positioning arithmetic all call them,
so inverting the axis is a `DIRECTION` constant plus a sign in those two bodies
(~5 lines). Nothing added later makes it harder, PROVIDED new code goes through
`day2px`/`px2day` rather than reading `scrollTop` and doing its own arithmetic.

The only real cost is VERIFICATION: an inverted axis fails subtly (events drift,
crosshair off by a screen) at particular scroll positions, so it wants a
dedicated pass rather than being bundled with something else.

**Watch for:** any new code that computes position from `scrollTop` directly must
honour `DIRECTION`. Keep routing through `day2px`/`px2day`.

## Order of work
1–8 now (one pass). 9 with them (it is UI in the popover). 10 separately, last,
after everything is verified and deployed — so a regression is easy to isolate.

## Verify
`./check.sh`, `node audit_ui.js`, real-browser geometry (crosshair/readout),
both-closed / one-open panel behaviour, then commit + deploy.
