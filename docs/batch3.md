# Batch 3 — collapsible regions 2 and 3 (events panel)

Scoped 2026-11-17. Renumbers the page: old region 3 (right column) becomes
**region 4**; a new **region 3** is inserted between region 2 and region 4.

## Layout

```
┌────────┬──────────┬──────────────────────────────┐
│   2    │    3     │             4                │
│calendar│ events   │  controls (outside the table) │
│ list   │  panel   │  row 1  coordinates           │
│        │          │  row 2  the timeline          │
│[collapse]│[collapse]│  row 3  legend              │
└────────┴──────────┴──────────────────────────────┘
```

## Region 2 — collapsible  ✅ decided (a)

- Open: as today (284px).
- Collapsed: a **thin vertical strip** with the word **"Calendars" rotated 90°**,
  plus an expand control. Clicking the strip reopens.

## Region 3 — events panel (new)  ✅ decided (b)

- Sits between region 2 and region 4. **Expandable and collapsible.**
- Collapsed: a **thin vertical strip with "Events" rotated 90°**.
- Contents when open:
  - a **filter dropdown at the top**: `All events` + one entry per calendar
  - the events list, **sorted chronologically**
  - each row **compact**: title, date, **edit**, **delete**
- The full event editor stays on `events.html`; this panel is the working list.

## Toggle behaviour  ✅ decided

- **Only one open at a time** — opening one closes the other.
- **Both can be closed** simultaneously.
- **Default state: region 2 open, region 3 closed.**

## Notes for implementation

- Region 3's dates: show the event's native date; sorting is by absolute day
  (`Store.eventDay`) so events from different calendars interleave correctly.
- Edit in region 3 should reuse the same drawer as `events.html` — factor the
  event editor into `cal/eventeditor.js` rather than duplicating it.
- Collapse state should survive reloads → localStorage.
- Watch row 2 alignment: region 4's width changes when 2 and 3 toggle, but the
  ruler/column geometry is independent of width — only horizontal scroll extent
  changes. Verify with `audit_ui.js`.
- `events.html` keeps working as the full page.

## Verify

`./check.sh`, then `node audit_ui.js`, then check both collapsed / one-open-at-a-time
in the real browser.
