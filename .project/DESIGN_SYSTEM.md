<!-- OWNER: Design / Build · READERS: Build, Landing, SEO -->
# Design System

The **committed** visual direction. Build / Landing / Design MUST follow this so the
product stays consistent. Change it deliberately, and commit the change.

## Direction
Conventional trading-desk interface: a cool white working surface, deep blue navigation, disciplined data tables, and green/red only for market meaning.

## Palette
| Token | Value |
|-------|-------|
| background | oklch(0.985 0.006 250) |
| surface | oklch(1 0 0) |
| text / muted | oklch(0.22 0.02 255) / oklch(0.5 0.018 255) |
| border | oklch(0.905 0.012 250) |
| primary | oklch(0.43 0.105 252) |
| accent | oklch(0.935 0.03 245) |
| success / warning / danger | oklch(0.55 0.14 153) / amber / oklch(0.56 0.18 29) |

## Typography
- Headings: system sans, semibold with tight tracking
- Body: system sans, readable 14–16px scale
- Data: system monospace with tabular numerals

## Tokens & primitives
- Radius / shadow / spacing rhythm: 0.625rem controls, restrained borders, minimal shadow, 4px spacing rhythm.
- Shared components: shadcn buttons, inputs, labels, tables, and semantic panels.
- Signature moment: the market chart sits beside an explicit automation state and live position summary; no decorative market claims.

## Voice & tone
Plain and exact. State when orders are real, when the monitor is not running, and what each risk limit cannot guarantee.
