# Calendar types, states, timeline view — requirement (2026-11-19)

Saved for review. NOT built. See "impact" at the bottom.

## 1. Types (4)

| type | id | rules | display fmt | events |
|---|---|---|---|---|
| Ruler | `ruler` | no | editable | none |
| Calendar Clone | `clone` | no | editable | ALL calendar events |
| Custom Clone | `custom-clone` | no | editable | clone of parent clone's events + custom |
| Custom Calendar | `custom` | EDITABLE | editable | custom events |

## 2. States (2)

`anchored` | `floating`

## 3. Timeline view settings (global)

Magnification · Time units · Labels · Tick marks · Calendar ordering

## 4. Rules

- At least ONE default Ruler, for anchoring.
- Rulers CANNOT be floating.
- Secondary rulers may be added, anchored to the default ruler.
- Calendar Clone: anchored to the ruler IF the default ruler is the parent;
  may float if the parent is not the default ruler, but an anchor assumption
  must then be created.
- Custom Clone: anchored to its parent calendar clone.
- Custom Calendar: anchored OR floating.

## 5. Initial state (no rulers / no calendars)

Choose a default ruler:
  - Proleptic Gregorian (recent civil history)
  - Proleptic Julian (best for pre-AD 8)
  - Proleptic Hijri (Islamic perspective)
  - Other

Once set, any new calendar added to the timeline must anchor to the ruler, or
remain floating (with an assumed anchor, or multiples).

## 6. Anchor types

- Event date = ruler epoch + number of days
- Event date = event date on Ruler clone + number of days

## 7. Timeline layout (from global settings)

Calendar ordering (left→right), Calendar width.

| view | header | columns |
|---|---|---|
| Ruler | 60 | 1 × 60 (labels) |
| Floating Clone | 240 | 30 (anchor assumption) + 210 (events) |
| Anchored Clone | 240 | 240 (events) |
| Floating Custom Clone | 240 | 30 + 210 |
| Anchored Custom Clone | 240 | 240 |
| Floating Custom | 240 | 30 + 210 |
| Anchored Custom | 240 | 240 |

## 8. Ticks

Major (labelled): limit >= 30 px · light grey · 2 px
Minor (no label): >= 5 px and < 30 px · dark grey · 1 px

Per unit — size / format:
Millennium Large YYYY · Century Medium YYYY · Decade Small YYYY ·
Year Small YYYY · Month Small MM or name · Day Small DD

---

# IMPACT REVIEW (against the current code)

## Already exists
- `type` field (`builtin` / `clone` / `custom`) — rename `builtin` -> `ruler`
  for the ruler role is wrong: today `builtin` is a CALENDAR type, and the
  ruler is chosen via `REF_ID` (a calendar id), not a type.
- `boundFrom` / `boundTo` (from Part 1)
- Tick thresholds 5/30 px, colours/thickness in CSS
- `RULER_W = 78`, `COLW = 210`

## New / not built
- **`state` (anchored|floating)** — nothing exists (`grep floating` = 0 hits)
- **anchor model** — no parent/anchor field; `epochCal` exists for custom
  calendars but is not an anchor-to-ruler
- **4 types** — only 3 exist, and `custom-clone` (with inherited events) is new
- **event inheritance** — clones currently share no events
- **floating 2-column layout** (30 + 210) — columns are a single width today
- **anchor-assumption rail** (C1 = 30 px)
- **default-ruler initial state / onboarding** — no such flow
- **secondary rulers** — only one `REF_ID`

## Conflicts to resolve
1. `builtin` vs `ruler`: today the ruler is any calendar selected by `REF_ID`.
   The requirement makes RULER a TYPE. That changes `REF_ID` and the sidebar.
2. `COLW = 210` matches the requirement's 210 event column — good.
   `RULER_W = 78` should become 60.
3. Part 1's `boundFrom/boundTo` are about VALIDITY; this requirement's
   floating/anchored is about ANCHORING. Orthogonal — keep both.
4. The tick spec here matches batch5 section B (global settings) — same work.

## Suggested sequencing (pending list)

**2026-11-19: virtual scrolling is DEFERRED.** Abe can live with the px/day
ceiling for now; it will be done on a branch later. Do the other pending work
first and get to a good checkpoint.

1. ~~Virtual scrolling~~ -> **deferred, branch later**
2. Ruler as a type + default-ruler initial state
3. State (anchored/floating) + anchor model + floating 2-column layout
4. Clone/custom-clone event inheritance
5. Global settings panel (magnification, time units, labels, ticks, ordering)

## Ceiling reference (for when we return)

content height = DAYS_TOTAL x PPD, browser cap = 2^24 = 16,777,216 px.
At 6.5 px/day -> ~7,000 years total (the current 5000 BCE - 2028 span).
At 20 px/day -> ~2,300 years. At 30 px/day -> ~1,500 years.
Virtual scrolling removes the trade entirely: px/day becomes a pure zoom.
