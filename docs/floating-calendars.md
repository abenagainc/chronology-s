# Floating / assumed calendars — design note

Status: **decided, not yet built.** Owner ruling 2026-11-17.
Related: README.md ("Known limits"), the day-anchoring rule.

## The question

> Are all custom calendars' epochs anchored to the proleptic Gregorian calendar,
> or can a calendar be floating without an anchor/epoch? I see a need for a
> floating calendar.

## The ruling

**Every calendar always carries an anchor value, so every calendar always
converts.** "Floating" means the anchor is **assumed, not committed** — not that
conversion is impossible.

Owner: *"I don't see why it can't convert if there is always going to be an
anchor value assumed. Based on that, all conversions should be possible but also
change automatically as the anchor changes."*

## What this replaces

An earlier framing in conversation claimed a floating calendar "can't convert".
That was wrong. A calendar's epoch is a **claim about position**, not a property
that enables arithmetic. If a value exists, the arithmetic works. The honest
distinction is about *commitment*, not capability:

| state | anchor | converts? | how it renders |
|---|---|---|---|
| **committed** | owner accepts this epoch | yes | normal column on the absolute axis |
| **assumed** | a value is present, not yet accepted | yes | side rail + `assumed` marker; still converts |

## Why this is the right model

1. **It matches the rest of the project.** Chronology X already carries
   assumed-held originals and proposed claims. A calendar epoch is the same
   shape: a value with a status, not a fact.
2. **It refuses to invent history.** An unanchored calendar must never be
   *given* a real epoch to make the diagram work — that is exactly the deduction
   the anti-deduction rule forbids. An explicitly **assumed** value, labelled as
   such, is honest; a silently-derived one is not.
3. **Re-anchoring is a single edit.** Because the anchor is one value, changing
   it recomputes every date, event and conversion downstream. Nothing else needs
   to be touched.

## Behaviour

- An assumed calendar's column draws in a **rail beside the absolute axis**, not
  on it — the rail is a truthful "position not established" statement, while
  keeping the structure visible and inspectable.
- It carries a visible `assumed` marker (same visual language as the existing
  `assumed` flag elsewhere in the project).
- Events in it convert normally; the conversion is labelled with the anchor
  status so a reader knows it is provisional.
- Changing the anchor value re-derives the calendar's position immediately.
- Committing the anchor moves the column onto the absolute axis.

## DECIDED 2026-11-17 (pause point — requirement recorded, NOT built)

Owner: *"lets pause this for now. keep this requirement under Floating calendar."*

### Status
`assumed` ↔ `committed` is a **toggle on the calendar**, not a separate object.
- Committing must NOT change the anchor value — only the status.
- In the database this is a claim-status change, not a bespoke boolean column.

### Events
Events may be entered in an assumed/floating calendar. The event stores its
**native date**; conversion to other calendars is a derived display, marked
provisional. Owner: *"most events created in such a calendar will be based on
that floating calendar alone."*

### Anchor types (menu when creating a floating calendar)
| type | anchor | note |
|---|---|---|
| **a** calendar-relative | "my day 0 = their day N" | base case |
| **b1** new event | create an event to anchor to | when nothing suitable exists |
| **b2** **shared event** | tie to an **existing** event in another calendar | preferred — inherits provenance |
| **c** offset | "their day N ± k" | for "3 days after X" |
| **d** range | "between day N and day M" | disputed epochs; conversion becomes a range and the column should render as a band |

**b2 is the owner's addition and is the important one.** It is (b1) where the
event already exists. Because the event is independently entered and sourced,
the anchor inherits its provenance — and multiple shared events give
**corroboration**: if they disagree, that is a detected conflict, not a silent
assumption.

### Consequence: a calendar holds a LIST of anchors, not one
Once two calendars are tied by several shared events, "the epoch" is a **set of
constraints** and the calendar's position is what satisfies them. Disagreement
between them is exactly what the review queue is for. This also reframes
committing: one assumed anchor is a guess; several mutually-consistent anchors
are *corroborated*, and that — not a manual decision — is what justifies
commitment.

### Open (decide before building)
- **Constraint enforcement:** check the anchors agree and flag conflicts now, or
  just record them and add the check later? (Deferred.)
- **Range anchors (d):** in the first pass or later? (Deferred.)
- **Rail ordering:** proposed "order by the anchor they assume, alphabetical
  within a group" — so calendars that rise and fall together sit together.
  (Owner: *"not sure i understand this question"* — re-ask with that framing.)

