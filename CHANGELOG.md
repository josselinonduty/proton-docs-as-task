# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0

Editable task boards (the board can now write back to the document):

- **Convert an empty document** into a task board from a Proton-styled button
  centered near the top — no need to type the activation marker by hand.
- **Edit the board without touching the text.** Add, rename and delete columns;
  add, edit, move and delete tasks; toggle done; and set status, priority, due
  date, assignee, labels, and a rich single-line description from board controls.
- While the board is open it is authoritative: edits are serialized back into
  the Proton (Lexical) editor (debounced), and the board rebuilds from the
  freshly parsed document each time it is reopened. Descriptions round-trip as a
  hidden `@desc(...)` token so they never clutter the reading view.
- The caret in the control you are editing is preserved across write-backs.

Tooling, CI, and documentation hardening (no user-facing behavior changes):

- Added ESLint + Prettier with `lint` / `format` / `format:check` scripts, and
  an `.editorconfig`; CI now lints and checks formatting.
- Added unit tests for the editor DOM serializer (`extractor.ts`).
- CI/release moved to Node 24 (dropping end-of-life Node 20); `package.json`
  now declares `engines.node >= 22`.
- Hardened GitHub Actions: pinned to commit SHAs, added least-privilege
  `permissions: contents: read` and concurrency cancellation to CI.
- Added `.github/dependabot.yml` (npm + GitHub Actions), `SECURITY.md`, and
  `CONTRIBUTING.md`.

## 0.1.0

Initial release.

- Detect an activation marker (`#!tasks`, `#!task`, `:::tasks`) on a document's
  first non-empty line and parse the checklist below it into a task model.
- Task DSL: markdown checkboxes, `## Heading` sections, and inline metadata
  (`@status`, `@priority`, `@due`, `@who` / `@@name`, `#labels`, and `!` / `!!`
  / `!!!` priority shorthands).
- Live Kanban / list board rendered in a Shadow DOM overlay on top of the
  Proton Docs editor, with group-by-status and group-by-section views, a
  progress bar, and dark-mode support.
- Toolbar popup showing activation status and a quick show/hide toggle.
- Options page to enable/disable the extension, customize markers, rename the
  status columns, and set default grouping / auto-show behavior. Settings sync
  via `browser.storage.sync`.
- Read-only by design: the document stays the single source of truth; the board
  updates live as the document is edited and never writes back.
- Cross-browser builds for Chrome (MV3) and Firefox (MV2) via WXT.
