# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

A rebuilt saving system that works through Proton's own editor.

- **No more "The underlying document changed" conflicts.** The board no longer
  scrapes the editor DOM and replays a synthetic paste. A page-world editor
  bridge attaches to Proton's Lexical editor, reads its state directly, and
  writes each board edit as one tagged Lexical update — so Proton's Yjs sync,
  history and saving handle it like typed text, and the board can tell its own
  writes apart from everyone else's without guessing from timing.
- **Changes merge instead of colliding.** A board edit is three-way merged with
  anything that changed in the document meanwhile, and only the blocks that
  changed are touched, so edits from your phone and your desktop (or a
  collaborator) both survive. Changes made elsewhere appear on the open board
  live, keeping open cards and selections.
- **Native headings and checklists.** Sections are written as real headings and
  tasks as real check-list items, so the document reads naturally in Proton
  too. Older plain-text boards convert the first time the board edits them.
- **Offline / locked editing.** While Proton has editing locked (loading,
  offline, view-only), board edits are kept and saved as soon as it unlocks;
  the header shows _Waiting to save_. Pending edits are also flushed when the
  tab is hidden or closed, which matters on mobile.
- Requires Chrome 111+ or Firefox 128+.

## [1.1.0](https://github.com/josselinonduty/proton-docs-as-task/compare/v1.0.0...v1.1.0) (2026-10-20)


### Features

* **board:** [@default](https://github.com/default) section marker for the list view ([41bcca8](https://github.com/josselinonduty/proton-docs-as-task/commit/41bcca8de167953241760f49283a760a48a22ea4)), closes [#37](https://github.com/josselinonduty/proton-docs-as-task/issues/37)
* **board:** add simple list view for basic task checklists ([0529768](https://github.com/josselinonduty/proton-docs-as-task/commit/05297682008063106ff7d34e22fa284666169d6c)), closes [#37](https://github.com/josselinonduty/proton-docs-as-task/issues/37)
* **board:** link tasks as blocking, blocked by or related ([596d2b0](https://github.com/josselinonduty/proton-docs-as-task/commit/596d2b0da03276dcbbe498d1aa3a4fe239f09526))


### Bug fixes

* **board:** minor UI issues ([#52](https://github.com/josselinonduty/proton-docs-as-task/issues/52)) ([950f4d1](https://github.com/josselinonduty/proton-docs-as-task/commit/950f4d130f48692bb8c8f9b6510fb5fae02b58dd))
* **board:** normalize redundant [@status](https://github.com/status) tokens when opening the board ([22e6a1c](https://github.com/josselinonduty/proton-docs-as-task/commit/22e6a1c6b611066b2ab63de61af95422c1c54531))
* **board:** show drop placeholder while dragging cards ([9b69577](https://github.com/josselinonduty/proton-docs-as-task/commit/9b69577d61eed650fbbdc0592bf102dda157dc63))
* **parser:** let a ticked checkbox resolve to done over a stale [@status](https://github.com/status) ([7414531](https://github.com/josselinonduty/proton-docs-as-task/commit/7414531c7ddef0e556d0e80ced886a6b97587627))


### Documentation

* add app screenshots ([492c057](https://github.com/josselinonduty/proton-docs-as-task/commit/492c05744077471e4115620d86ed42e1e805c6a0))

## [1.0.0](https://github.com/josselinonduty/proton-docs-as-task/compare/v0.7.1...v1.0.0) (2026-10-19)


### Features

* align the design system with Proton's current Snow and Carbon themes ([82ab70a](https://github.com/josselinonduty/proton-docs-as-task/commit/82ab70aa9b5b476e7356e23f6da354933b0e446d))
* **board:** task details panel, board header and keyboard/a11y fixes ([9007949](https://github.com/josselinonduty/proton-docs-as-task/commit/9007949547a191ab69b11dc8440f19131632848f))
* **branding:** brand the Docs shell and add a kanban board icon ([091e813](https://github.com/josselinonduty/proton-docs-as-task/commit/091e81339685c80c586453981b6ba8759e0dc076))
* new app icon, also used in the settings and popup headers ([bb72f50](https://github.com/josselinonduty/proton-docs-as-task/commit/bb72f50cc713424b87972cc7185c317d6a85e102))


### Bug fixes

* **editor:** only bridge to the document editor, not Sheets editors ([dca0c5e](https://github.com/josselinonduty/proton-docs-as-task/commit/dca0c5e88f7c7df3d057992180f56c6eee0afb9f))


### Refactoring

* save through Proton's Lexical editor instead of DOM paste ([3808904](https://github.com/josselinonduty/proton-docs-as-task/commit/38089046069f00c090b44baa7e7f981df5bd1bce))
* save through Proton's Lexical editor instead of DOM paste ([d528391](https://github.com/josselinonduty/proton-docs-as-task/commit/d52839189c6a1864d40134ef593ecc425dc90e17))


### Chores

* release 1.0.0 ([1e31e10](https://github.com/josselinonduty/proton-docs-as-task/commit/1e31e109ddf19993f40e85d8962c065e0f651786))

## 0.6.2

Follow-up board fixes.

- **Due-date field matches the other controls.** The "Set due date" trigger now
  uses the same input styling and size as the Status/Section/Priority selects,
  the leftover Unicode glyph is gone, and its popover floats above the card
  (fixed positioning) instead of being clipped inside the scrolling body.
- **Extension settings opens.** The overflow-menu settings item now works from the
  in-page board — content scripts can't call `openOptionsPage` directly, so it is
  routed through the background script.
- **Delete dialog button color fixed.** The confirm-delete button is now a solid
  red button instead of a purple fill with red text.
- Removed the "No tasks yet" board placeholder.

## 0.6.1

Board chrome polish and interaction fixes.

- **Filter/sort/menu clicks fixed.** Clicking a checkbox, label or option inside
  the Filters, Sort or overflow menus no longer closes the whole menu. Outside-click
  detection now uses the event's composed path so it works across the extension's
  shadow-root boundary.
- **Keyboard shortcuts work on open.** The board takes focus when it opens, so
  shortcuts (`N`, `/`, `F`, `V`, `S`, `J`/`K`, `?`, …) fire immediately without a
  first click into the board.
- **Single toolbar row.** The board header is now one line of controls (view,
  search, filters, sort, Add task, Back, overflow) instead of two. The extension's
  own board icon, board-title input and progress bar were removed — Proton Docs
  already shows the document title, and its own save status replaces the board's
  "Saved" indicator (a failed save or external-change conflict is still surfaced,
  since Proton can't report those).
- **Extension settings in the overflow menu.** The `⋮` menu now has an
  **Extension settings** item.
- **Proton-style icons.** Chevrons, arrows, the overflow/details dots, the close,
  plus, and check glyphs are now consistent inline SVG icons drawn on Proton's
  16px grid, replacing the previous mix of Unicode characters.
- Removed the "Sorted by … — drag-and-drop is off" note and the now-unused
  **Show progress bar** setting.

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
