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

Proton's product UI (Mail, Drive, Docs, …) is built on its own design system
in the open-source [`ProtonMail/WebClients`][webclients] monorepo. The
extension can't import it (it's self-contained and network-free), so
`tokens.css` mirrors its values directly:

| Proton source                                  | What the extension takes from it                                                                                      |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/colors/themes/dist/snow.theme.css`   | Light palette: warm neutrals (`#f5f4f2`, `#d1cfcd`, `#5c5958`), brand `#6d4aff`, signal colors, `minor`/`major` steps |
| `packages/colors/themes/dist/carbon.theme.css` | Dark palette: `#16141c` surfaces, `#8a6eff` accent, while solid buttons keep `interaction-norm` `#6d4aff`             |
| `packages/styles/scss/lib/_config.scss`        | 14px / 20px base type, 3px focus ring                                                                                 |
| `packages/atoms/src/Button/ButtonLike.scss`    | Button shapes (solid / outline / ghost), 36px medium and 28px small heights, hover = one step _darker_                |
| `packages/styles/scss/base/_fonts.scss`        | Inter as the UI typeface                                                                                              |

Conventions that follow from it:

- **Purple is for the one primary action** (`.pdt-btn-primary`, e.g. _Add
  task_). Toggle-like controls that are "on" (Filters with filters applied,
  an active sort) use the tinted `.pdt-btn-selected`, never a second solid
  purple button.
- **Semantic color names** (`background-norm` / `-weak` / `-strong` /
  `-lowered` / `-elevated`, `text-norm` / `-weak` / `-hint`, `border-norm` /
  `-weak`, `field-norm` / `-hover`, `interaction-hover` / `-active`) mirror
  Proton's variables, so the palette is easy to reason about and re-theme.
- **Readable signal chips**: each signal has a base color, a `-weak` tint for
  chip backgrounds and a `-text` step for text on that tint. `-text` uses
  Proton's darker steps so 12px chip labels meet WCAG AA; the light warning
  text is one step darker than Proton's palette for the same reason (noted in
  `tokens.css`).
- **Status swatches** (`--pdt-swatch-<name>-text` / `-bg`) are the named
  colours a board can give its statuses. They alias the palette tokens, so
  they inherit dark mode and readable text-on-tint for free — add a swatch by
  aliasing an existing pair, never with a new raw value. Custom hex colours a
  user picks are their own; the board only warns when a pair is below AA.
- **Inter without bundling it**: the font stack leads with `InterVariable,
Inter`. Proton's page already loads them, and page-level `@font-face`
  rules apply inside the board's shadow root, so the board renders in
  Proton's typeface without the extension shipping a font file.
- **Visible keyboard focus everywhere**: interactive elements get Proton's
  focus treatment (focus-colored border + 3px `--pdt-focus-ring`) on
  `:focus-visible`. Use `.pdt-focusable` on custom controls that aren't
  `.pdt-btn`/`.pdt-link`.
- **Light chrome**: Proton's current default theme (Snow) has light
  navigation, so there is no always-dark "nav" surface any more. Floating
  feedback (the undo toast) uses `--pdt-background-invert`, like Proton
  notifications.
- **Restrained elevation**: flat by default; `--pdt-shadow-*` only on cards,
  popovers, dialogs and floating bars.
- **Automatic light/dark** via `prefers-color-scheme`, overridable with the
  Theme setting.

[webclients]: https://github.com/ProtonMail/WebClients

## Tokens (`src/styles/tokens.css`)

Applied to both `:root` (popup/options, ordinary documents) and `.pdt-host`
(the shadow-DOM root of the board overlay), so one file drives every
surface. Categories: brand/interactive, surfaces & text, signal colors,
status swatches, elevation, radius, spacing (4px scale), typography, motion. Always reach for
a token (`var(--pdt-...)`) over a hard-coded value.

## Components (`src/styles/components.css`)

| Class                                                                                                                                                                 | Use for                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `.pdt-btn` (+ `.pdt-btn-primary`, `.pdt-btn-selected`, `.pdt-btn-danger`, `.pdt-btn-danger-solid`, `.pdt-btn-ghost`, `.pdt-btn-icon`, `.pdt-btn-pill`, `.pdt-btn-sm`) | Every clickable button. Compose the base class with one modifier for color/shape.                                                   |
| `.pdt-link`                                                                                                                                                           | A text-only action styled as a link, never a bordered button.                                                                       |
| `.pdt-input`, `.pdt-select`, `.pdt-textarea` (+ `.pdt-textarea-code` for raw syntax)                                                                                  | Form controls — consistent border, radius, focus ring.                                                                              |
| `.pdt-focusable`                                                                                                                                                      | Adds the standard focus ring to a custom interactive element.                                                                       |
| `.pdt-native-check`                                                                                                                                                   | Native checkboxes/radios that should pick up the brand accent color.                                                                |
| `.pdt-switch-row` / `.pdt-switch`                                                                                                                                     | An on/off toggle (`<label class="pdt-switch-row"><span>Label</span><input type="checkbox"/><span class="pdt-switch"/></label>`).    |
| `.pdt-card`                                                                                                                                                           | A bordered, padded panel/section.                                                                                                   |
| `.pdt-badge` (+ `-primary`, `-danger`, `-warning`, `-success`)                                                                                                        | Small tinted status/count pills.                                                                                                    |
| `.pdt-badge-solid` (+ `-primary`, `-danger`, `-warning`, `-success`)                                                                                                  | Solid-fill status pill (white text), for a prominent state readout like Proton's "ACTIF"/"DÉFAUT" chips. Combine with `.pdt-badge`. |
| `.pdt-code`                                                                                                                                                           | Inline code snippets outside the board overlay (`.pdt-host code` is styled automatically inside it).                                |
| `.pdt-field` / `.pdt-field-label`                                                                                                                                     | A labeled form field wrapper.                                                                                                       |
| `.pdt-text-weak`                                                                                                                                                      | Secondary/muted text.                                                                                                               |

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
   with the OS theme toggled. `npm run playground` mounts the real board
   against a fake document for exactly this (see README).
4. Check text-on-tint contrast (≥ 4.5:1 for text under 18px) when adding a
   colored chip.
