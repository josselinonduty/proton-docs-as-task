# Style guide

The extension's UI spans three independent surfaces — the toolbar **popup**,
the **options** page, and the **board overlay** injected into the Proton Docs
editor as a shadow-DOM tree. All three now read from one shared design
system so they look and behave like a single product, styled to sit
naturally next to Proton's own UI.

```
src/styles/
├─ tokens.css      # design tokens (colors, spacing, radius, type, motion)
└─ components.css  # reusable component classes (buttons, inputs, badges…)
```

Every entrypoint stylesheet starts with:

```css
@import '../../styles/tokens.css';
@import '../../styles/components.css';
```

and then adds only the layout rules specific to that surface. Don't
reintroduce colors, radii or button/input styling locally — extend
`components.css` instead so the change applies everywhere.

## Matching Proton's design language

Proton's product UI (Mail, Drive, Docs, …) is built on its own internal
design system, so this extension can't literally reuse it — instead
`tokens.css` approximates its conventions as closely as a self-contained,
network-free browser extension reasonably can:

- **Brand purple accent** (`--pdt-primary`, `#6d4aff`) on otherwise quiet,
  low-saturation neutral surfaces — Proton uses color sparingly, reserved for
  primary actions, active states and the brand mark.
- **Semantic, not literal, color names** (`background-norm` / `-weak` /
  `-strong`, `text-norm` / `-weak` / `-hint`, `border-norm` / `-weak`,
  `signal-danger` / `-warning` / `-success` / `-info`) mirroring the naming
  used across Proton's own web apps, so the palette is easy to reason about
  and to re-theme.
- **Rounded, friendly geometry**: 8px as the default control radius, up to a
  full pill for primary/floating actions (`--pdt-radius-*`).
- **Restrained elevation**: flat by default, a soft shadow only on floating
  or overlay elements (`--pdt-shadow-*`), never on inline content.
- **System font stack** rather than a bundled webfont — the extension makes
  no network requests and ships no font assets, so it leans on the
  platform's UI font instead of Proton's Inter typeface. This is the one
  deliberate departure from a byte-for-byte match.
- **Automatic light/dark** via `prefers-color-scheme`, matching how Proton's
  own apps follow the OS theme.

## Tokens (`src/styles/tokens.css`)

Applied to both `:root` (popup/options, ordinary documents) and `.pdt-host`
(the shadow-DOM root of the board overlay), so one file drives every
surface. Categories: brand/interactive, surfaces & text, signal colors,
elevation, radius, spacing (4px scale), typography, motion. Always reach for
a token (`var(--pdt-...)`) over a hard-coded value.

## Components (`src/styles/components.css`)

| Class                                                                                                                   | Use for                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `.pdt-btn` (+ `.pdt-btn-primary`, `.pdt-btn-danger`, `.pdt-btn-ghost`, `.pdt-btn-icon`, `.pdt-btn-pill`, `.pdt-btn-sm`) | Every clickable button. Compose the base class with one modifier for color/shape.                                                |
| `.pdt-link`                                                                                                             | A text-only action styled as a link, never a bordered button.                                                                    |
| `.pdt-input`, `.pdt-select`, `.pdt-textarea`                                                                            | Form controls — consistent border, radius, focus ring.                                                                           |
| `.pdt-native-check`                                                                                                     | Native checkboxes/radios that should pick up the brand accent color.                                                             |
| `.pdt-switch-row` / `.pdt-switch`                                                                                       | An on/off toggle (`<label class="pdt-switch-row"><span>Label</span><input type="checkbox"/><span class="pdt-switch"/></label>`). |
| `.pdt-card`                                                                                                             | A bordered, padded panel/section.                                                                                                |
| `.pdt-badge` (+ `-primary`, `-danger`, `-warning`, `-success`)                                                          | Small status/count pills.                                                                                                        |
| `.pdt-code`                                                                                                             | Inline code snippets outside the board overlay (`.pdt-host code` is styled automatically inside it).                             |
| `.pdt-field` / `.pdt-field-label`                                                                                       | A labeled form field wrapper.                                                                                                    |
| `.pdt-text-weak`                                                                                                        | Secondary/muted text.                                                                                                            |

Surface-specific classes (`pp-*` for the popup, `op-*` for options, the
board's own `pdt-board__*` / `pdt-column__*` / etc.) are layout-only: they
position and size things, and defer color/typography/spacing to the tokens
and shared components above.

## Naming conventions

- Shared, reusable classes live in `components.css` and are prefixed
  `pdt-` with flat modifier suffixes (`pdt-btn-primary`, not BEM
  double-dashes) — they're meant to be composed (`class="pdt-btn
pdt-btn-primary pdt-btn-sm"`).
- Surface-local, layout-only classes keep a short surface prefix
  (`pp-` popup, `op-` options) or, inside the board overlay, a
  loose BEM-ish `pdt-block__element` / `pdt-block--modifier` scheme, since
  those never need to be reused outside their surface.
- Never introduce a new color, radius or shadow value inline — add a token
  if the existing ones don't fit, and explain why in the token's comment.

## When adding new UI

1. Reach for an existing token/component first.
2. If a genuinely new pattern is needed, add it to `components.css` (not a
   one-off in a surface stylesheet) so the next surface can reuse it.
3. Check both color schemes — every token already has a dark-mode override,
   so components built from tokens get dark mode for free; verify visually
   with the OS theme toggled.
