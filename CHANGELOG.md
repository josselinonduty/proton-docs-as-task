# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
