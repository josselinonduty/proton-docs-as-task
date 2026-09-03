# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.6.0

A faster, more comfortable board for daily use. Everything new here builds on the
v0.5 task model without introducing any required Markdown — sorting, filters,
density, view selection and collapsed states are UI preferences only.

- **Quick capture.** An **Add task** form in the board header (title required;
  status, section, due date, priority, assignee and labels optional) that
  remembers the last section, submits with `Cmd`/`Ctrl`+`Enter`, highlights the
  new card, and warns when active filters would hide it. The **extension popup**
  can add a task straight into the active document and only reports success once
  the write is confirmed (and defers to the board when a conflict exists).
- **Sorting.** A per-view sort menu — due date, priority, title, assignee,
  recently created — that is non-destructive by default (Manual restores the saved
  order), disables drag while active, and offers an undoable **Apply this order to
  document**.
- **Suggestions.** Assignee and label inputs are now accessible comboboxes whose
  suggestions come from values already in the document (case-insensitive, existing
  capitalization preserved, with usage counts); labels are a token input with
  duplicate prevention.
- **Improved due dates.** A lightweight date control with deterministic quick
  options (Today, Tomorrow, This weekend, Next week, Clear) and readable states
  (Overdue, Due today/tomorrow/this week, Future, Completed) in the local timezone.
- **Swimlane view.** Status columns × section rows, with drag that changes status,
  section or both, collapsible rows, and a wide-board warning.
- **Bulk selection & actions.** Selection mode with `Shift`-range and select-all,
  and atomic, undoable bulk status / section / priority / assignee / due / label /
  complete / delete across the selection.
- **Keyboard & command palette.** A full set of board shortcuts, a searchable
  command palette (`Cmd`/`Ctrl`+`K`), and a shortcut reference (`?`).
- **Filters.** Filter chips in the header, exclude filters, and one-click presets
  (My open tasks, Overdue, Due this week, High priority, Unassigned, Recently
  completed).
- **Display preferences.** Card-field visibility, completed-tasks presentation
  (show / collapse Done / hide), a configurable date format, and your own name for
  the _My open tasks_ preset — plus per-document session memory of view, sort,
  filters and collapsed columns/rows.
- New tested modules (`dates`, `sorting`, `suggestions`, `session`, filter presets
  and bulk model actions) plus React interaction tests for the new components.
  Chrome and Firefox builds pass all checks; v0.4/v0.5 documents open unchanged.

## 0.5.0

A coherent, dependable daily-use task board. **Status and section are now
independent** properties of a task, and the same task collection is shown in two
interchangeable layouts without ever losing data.

- **Two views.** _Workflow_ groups cards into the To Do / In Progress / Done
  status columns; _Sections_ groups them by `## Heading`. Moving a card in
  Workflow changes only its status (and ticks/unticks the checkbox); moving it in
  Sections changes only its section. The chosen view persists as your default and
  switching never mutates task data.
- **Move by pointer or keyboard.** Drag-and-drop plus fully keyboard-accessible
  equivalents (`Alt`+`↑`/`↓` and explicit Move / Move to… controls); moves are
  announced to screen readers and focus follows the moved card.
- **Search & filters.** Case-insensitive search across title, description,
  assignee, labels and section, combinable filters (status, section, priority,
  assignee, label, due date, completion), a one-click clear, and empty states for
  columns with no matches. Filtering only changes visibility.
- **Save state & conflict handling.** The header shows _Saved_ / _Saving…_ /
  _Save failed_ (with **Retry**) / _Document changed_. External document changes
  offer Reload, Keep board version, or Cancel instead of a silent overwrite.
- **Undo** for moving a card, deleting a card, and deleting a section (including
  the bulk move/delete of its tasks), via a single-level toast.
- **Safe section deletion.** Deleting a non-empty section asks whether to move
  its tasks elsewhere (the default) or delete them too; deleting tasks is
  confirmed and undoable. Workflow status columns can't be deleted.
- **Progress** summary (completed / total / percentage + bar) that ignores
  filters, plus a collapsible Done column.
- **More settings.** Default view, theme (System / Light / Dark), card density,
  new-cards-at-top/bottom, description previews, collapse-Done-by-default,
  confirm-delete, progress-bar toggle, and validation preventing an empty
  activation-marker configuration.
- **Accessibility.** Visible focus, focus-trapping dialogs that close on Escape,
  labelled inputs, non-color state indicators, and reduced-motion support.
- Existing v0.4 task documents open with no manual migration. New pure modules
  (`model`, `filters`, `sync`) carry automated tests for the model, serialization,
  movement, filtering and conflict behavior.

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
