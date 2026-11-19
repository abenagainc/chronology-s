# Part 1 — per-calendar validity bounds

Decided 2026-11-18 (Abe). Build Part 1 first, Part 2 (virtual scrolling) after.

## The model

A calendar carries its own bounds as DATA, expressed in its OWN units (y/m/d).

| kind | start | end | renders |
|---|---|---|---|
| `unbounded` | none | none | everywhere |
| `start-only` | yes | none | from start onward |
| `end-only` | none | yes | up to end |
| `bounded` | yes | yes | between |

## Ruling

- outside its bounds a calendar still CONVERTS (anchor always exists) but
  renders NOTHING — no ticks, no labels, no events
- the out-of-bounds area is DARKER than in-bounds, with no ticks or labels
- the ruler is `unbounded`
- `assumed` (floating) is ORTHOGONAL — a calendar can be assumed AND bounded
- bounds live in the calendar's own units, converted to a day index via its epoch

## Built-in bounds (agent's call, Abe to revise)

| calendar | bounds | why |
|---|---|---|
| Proleptic Gregorian | unbounded | proleptic by definition |
| Proleptic Hijri (tabular) | unbounded | tabular/arithmetic, no historical start |
| Julian | unbounded | proleptic |
| Egyptian | start-only, from its epoch | a historical calendar, not proleptic backward |
| Maya Haab | start-only, from its epoch | same |
| Blank / custom | unbounded | no claim either way |

## UI

- region 2 row shows the bound state (e.g. "from 1582", "1582 – 1752", "all")
- editable for CUSTOM calendars; built-ins display only
- editor gains start / end fields (y/m/d in that calendar's units)

## Verify

`./check.sh`, `node audit_ui.js`, `node verify_position.js` (must stay 24/24),
plus new: a bounded calendar renders nothing outside its bounds and the area is
darker; a calendar with no content in view still converts in the readouts.
