# Calendar TYPES — ruling (2026-11-19)

Three types, not two. A type determines which fields are editable.

| | type id | rules | display formatting | events |
|---|---|---|---|---|
| **Ruler** | `ruler` | not editable | editable | none |
| **Built-in** | `builtin` | not editable | editable | none |
| **Calendar Clone** | `clone` | not editable | editable | CAN have events |
| **Custom Calendar** | `custom` | EDITABLE | editable | CAN have events |

## The distinction that matters

Built-in vs Clone is NOT about rules — both have frozen rules. It is about
**events**: a built-in carries no events, a clone can.

So `clone` = a display copy of a built-in, made so it can hold events.

## Duplicate flow

Prompt with two labelled buttons, not OK/Cancel:

    [ Create Clone ]   [ Create Custom ]

- **Create Clone**  -> duplicates the calendar, rules frozen, display editable,
  added straight away (no drawer). Same shape as a built-in.
- **Create Custom** -> duplicates the calendar AND opens the drawer with every
  variable pre-filled from the source (rules + display), ready to adjust.

## Editor behaviour by type

| type | drawer shows |
|---|---|
| builtin | colour + format only (rules read-only/absent) |
| clone | colour + format only (rules read-only/absent) |
| custom | colour + format + all data variables (months, lengths, leap, epoch, era, bounds) |

## Note

My previous implementation was wrong: it offered OK/Cancel and opened the editor
for the "adjust" path only. Correcting to the two labelled actions above.
