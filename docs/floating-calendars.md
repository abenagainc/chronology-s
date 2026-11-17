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

## Open points (decide before building)

1. **What may an assumed anchor be stated in?** Another calendar's date (like a
   committed epoch), or also "day 0 of this calendar = day N of that one"?
2. **Does the rail have its own ordering?** Probably sorted by name or by the
   date the assumption was recorded, not by time.
3. **Can an event be entered in an assumed calendar?** Suggested yes — the date
   is stored in that calendar's own numbering, and conversion is provisional.
   But the event should inherit the provisional marker.
4. **What commits an anchor?** A status field (`assumed` → `committed`) and, in
   the database, the claim-status mechanism rather than a separate flag.
