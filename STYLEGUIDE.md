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
- **Arial-led font stack**: Proton's own document editor defaults to Arial,
  so the extension leads with it rather than a system-UI font, falling back
  to the platform stack. No webfont is bundled — the extension makes no
  network requests and ships no font assets — so this is as close as it
  gets to Proton's actual typeface without one.
- **Neutral secondary buttons**: most Proton buttons (e.g. "Add a payment
  method") are white with a gray border and a plain gray hover background —
  purple is reserved for the one primary action on a screen. `.pdt-btn`'s
  default and hover states follow that; only `.pdt-btn-primary` uses purple.
- **White, bordered form controls**: Proton's own dropdowns/inputs sit on
  white with a visible border rather than a tinted fill; `.pdt-input` /
  `.pdt-select` match that, while `.pdt-textarea` keeps a tinted,
  monospaced treatment for the one code-like use case (raw marker editing).
- **Solid status chips**: Proton renders account/plan status ("ACTIF",
  "DÉFAUT") as small solid-color pills with white text, not tinted badges —
  `.pdt-badge-solid-*` covers that; the plain `.pdt-badge-*` tint remains
  for lighter-weight tags.
- **Persistent dark chrome**: Proton's settings navigation stays a dark
  near-black navy even in light mode, with white content cards next to it.
  `--pdt-nav-*` tokens capture that (independent of `prefers-color-scheme`)
  and back the options page's header band.
- **Automatic light/dark** via `prefers-color-scheme` for content surfaces,
  matching how Proton's own apps follow the OS theme.

## Tokens (`src/styles/tokens.css`)

Applied to both `:root` (popup/options, ordinary documents) and `.pdt-host`
(the shadow-DOM root of the board overlay), so one file drives every
surface. Categories: brand/interactive, surfaces & text, signal colors,
elevation, radius, spacing (4px scale), typography, motion. Always reach for
a token (`var(--pdt-...)`) over a hard-coded value.

## Components (`src/styles/components.css`)

| Class                                                                                                                   | Use for                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `.pdt-btn` (+ `.pdt-btn-primary`, `.pdt-btn-danger`, `.pdt-btn-ghost`, `.pdt-btn-icon`, `.pdt-btn-pill`, `.pdt-btn-sm`) | Every clickable button. Compose the base class with one modifier for color/shape.                                                   |
| `.pdt-link`                                                                                                             | A text-only action styled as a link, never a bordered button.                                                                       |
| `.pdt-input`, `.pdt-select`, `.pdt-textarea`                                                                            | Form controls — consistent border, radius, focus ring.                                                                              |
| `.pdt-native-check`                                                                                                     | Native checkboxes/radios that should pick up the brand accent color.                                                                |
| `.pdt-switch-row` / `.pdt-switch`                                                                                       | An on/off toggle (`<label class="pdt-switch-row"><span>Label</span><input type="checkbox"/><span class="pdt-switch"/></label>`).    |
| `.pdt-card`                                                                                                             | A bordered, padded panel/section.                                                                                                   |
| `.pdt-badge` (+ `-primary`, `-danger`, `-warning`, `-success`)                                                          | Small tinted status/count pills.                                                                                                    |
| `.pdt-badge-solid` (+ `-primary`, `-danger`, `-warning`, `-success`)                                                    | Solid-fill status pill (white text), for a prominent state readout like Proton's "ACTIF"/"DÉFAUT" chips. Combine with `.pdt-badge`. |
| `.pdt-code`                                                                                                             | Inline code snippets outside the board overlay (`.pdt-host code` is styled automatically inside it).                                |
| `.pdt-field` / `.pdt-field-label`                                                                                       | A labeled form field wrapper.                                                                                                       |
| `.pdt-text-weak`                                                                                                        | Secondary/muted text.                                                                                                               |

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
