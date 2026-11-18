---
name: "Candleline"
description: "An owner-controlled Binance.US spot-trading dashboard with an automated moving-average strategy and explicit risk limits."
colors:
  background: "oklch(0.985 0.006 250)"
  foreground: "oklch(0.22 0.02 255)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.22 0.02 255)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.22 0.02 255)"
  primary: "oklch(0.43 0.105 252)"
  primary-foreground: "oklch(0.985 0.006 250)"
  secondary: "oklch(0.955 0.012 250)"
  secondary-foreground: "oklch(0.27 0.025 255)"
  muted: "oklch(0.96 0.008 250)"
  muted-foreground: "oklch(0.5 0.018 255)"
  accent: "oklch(0.935 0.03 245)"
  accent-foreground: "oklch(0.32 0.065 252)"
  destructive: "oklch(0.55 0.19 28)"
  border: "oklch(0.905 0.012 250)"
  input: "oklch(0.89 0.018 250)"
  ring: "oklch(0.57 0.11 252)"
  sidebar-ring: "oklch(0.7 0.14 153)"
  sidebar-border: "oklch(0.34 0.035 255)"
  sidebar-accent-foreground: "oklch(0.97 0.005 250)"
  sidebar-accent: "oklch(0.28 0.04 255)"
  sidebar-primary-foreground: "oklch(0.2 0.035 255)"
  sidebar-primary: "oklch(0.7 0.14 153)"
typography:
  display:
    fontFamily: "system sans, semibold with tight tracking"
  body:
    fontFamily: "system sans, readable 14–16px scale"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, \"Liberation Mono\", monospace"
rounded:
  sm: "calc(var(--radius) * 0.6)"
  md: "calc(var(--radius) * 0.8)"
  lg: "0.625rem"
  xl: "calc(var(--radius) * 1.4)"
  2xl: "calc(var(--radius) * 1.8)"
  3xl: "calc(var(--radius) * 2.2)"
  4xl: "calc(var(--radius) * 2.6)"
---

<!-- Generated from .project/DESIGN_SYSTEM.md + app/globals.css by the engine. Tokens above are normative and mirror the CSS; edit the CSS and DESIGN_SYSTEM.md, not this file. -->

## Overview

Conventional trading-desk interface: a cool white working surface, deep blue navigation, disciplined data tables, and green/red only for market meaning.

## Colors

| Token | Value |
| background | oklch(0.985 0.006 250) |
| surface | oklch(1 0 0) |
| text / muted | oklch(0.22 0.02 255) / oklch(0.5 0.018 255) |
| border | oklch(0.905 0.012 250) |
| primary | oklch(0.43 0.105 252) |
| accent | oklch(0.935 0.03 245) |
| success / warning / danger | oklch(0.55 0.14 153) / amber / oklch(0.56 0.18 29) |

Declared in `globals.css` as `--color-*` and mirrored in the frontmatter. Use the token, never a raw hex.

## Typography

- Headings: system sans, semibold with tight tracking
- Body: system sans, readable 14–16px scale
- Data: system monospace with tabular numerals

- Display: `system sans, semibold with tight tracking`
- Body: `system sans, readable 14–16px scale`
- Mono: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`

## Layout

- Radius / shadow / spacing rhythm: 0.625rem controls, restrained borders, minimal shadow, 4px spacing rhythm.
- Shared components: shadcn buttons, inputs, labels, tables, and semantic panels.
- Signature moment: the market chart sits beside an explicit automation state and live position summary; no decorative market claims.

## Shapes

Radii: `sm` calc(var(--radius) * 0.6), `md` calc(var(--radius) * 0.8), `lg` 0.625rem, `xl` calc(var(--radius) * 1.4), `2xl` calc(var(--radius) * 1.8), `3xl` calc(var(--radius) * 2.2), `4xl` calc(var(--radius) * 2.6)

## Do's and Don'ts

- Voice: Plain and exact. State when orders are real, when the monitor is not running, and what each risk limit cannot guarantee.

- Do load faces through Fontsource, not `next/font/google`.
- Don't introduce a colour or radius that isn't a token above.
- Don't use gradient text, or a purple/violet gradient as the brand signal.
- Don't use bounce or elastic easing; real objects decelerate smoothly.
