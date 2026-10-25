# Changelog

All notable changes to this project are documented here. This project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2](https://github.com/josselinonduty/proton-docs-as-task/compare/v1.2.1...v1.2.2) (2026-10-25)


### Bug fixes

* **a11y:** give the board and sort menus arrow-key navigation ([2311dd6](https://github.com/josselinonduty/proton-docs-as-task/commit/2311dd6b8c5cf0244c53ecaef2c4a8b12d882949))
* **a11y:** make the view switcher keyboard-operable tabs ([b244977](https://github.com/josselinonduty/proton-docs-as-task/commit/b24497709a0132e46715bb553623493acba76c01))
* **board:** show pressed state on the List view section toggle ([#80](https://github.com/josselinonduty/proton-docs-as-task/issues/80)) ([89dc3f7](https://github.com/josselinonduty/proton-docs-as-task/commit/89dc3f7ace98806151b8e4e15465d4fa77f850ef))
* **bridge:** validate editor bridge payloads before using them ([fd770b1](https://github.com/josselinonduty/proton-docs-as-task/commit/fd770b151ff2750ed01cc533a62de8ce22bb5860))
* **deps:** apply npm audit fix for vite, brace-expansion, source-map-js and zod ([7d88e84](https://github.com/josselinonduty/proton-docs-as-task/commit/7d88e841f353095bcaa1bad7cabb050bea37a8fe))
* **deps:** bump i18next to 26.5.10 and react-i18next to 17.1.8 ([e11c927](https://github.com/josselinonduty/proton-docs-as-task/commit/e11c927f8bc9362bcee1095c55b70e3fa38f570a))
* **deps:** override happy-dom and vite to patched versions ([b2c440c](https://github.com/josselinonduty/proton-docs-as-task/commit/b2c440ce2c21a67a351282d3c2e5f91fcd1fea7b))
* **playground:** restrict dev server hosts to localhost and cloudflared tunnels ([d1a9164](https://github.com/josselinonduty/proton-docs-as-task/commit/d1a91647babffb46e9ea05abcc93f335b2feaff9))


### Performance

* **bridge:** stop polling for the editor in frames without one ([3f5ad3f](https://github.com/josselinonduty/proton-docs-as-task/commit/3f5ad3ff01e1c525a0b96edce9b234447e6bce58))


### Refactoring

* **board:** drive keyboard shortcuts from a key map ([d074222](https://github.com/josselinonduty/proton-docs-as-task/commit/d07422238a29560a4144c35e23f2949c085aed2b))
* **board:** extract card drag and drop into useBoardDnd ([b541639](https://github.com/josselinonduty/proton-docs-as-task/commit/b54163977e595373a26f25f920ceac4de6e8b47a))
* **board:** extract card selection into useBoardSelection ([a7e7aca](https://github.com/josselinonduty/proton-docs-as-task/commit/a7e7aca184118ac03a95ae65676d380378b63109))
* **board:** extract the details panel and its trail into useDetailsNavigation ([9a6949e](https://github.com/josselinonduty/proton-docs-as-task/commit/9a6949e4aa729113d11e16cc0e168046f33dd0d3))
* **board:** lay out columns and cards with useMemo, not during render ([15e30d3](https://github.com/josselinonduty/proton-docs-as-task/commit/15e30d34d9d729de4070aac234bd04d11c313f33))
* **board:** split EditableBoard into header, view, card and dialog components ([adaf980](https://github.com/josselinonduty/proton-docs-as-task/commit/adaf9802eea188ba711db9d4360fb29d47a42300))
* **board:** track the board's dialogs as one overlay state ([b474156](https://github.com/josselinonduty/proton-docs-as-task/commit/b474156628effe715a3607d7e0e6a8c96eb7349d))
* **components:** derive state instead of syncing it in effects ([112b459](https://github.com/josselinonduty/proton-docs-as-task/commit/112b459c7874b382d38bf2c39cf87fb5c2d2178b))
* **dialog:** render modals as native &lt;dialog&gt; elements ([1942d7f](https://github.com/josselinonduty/proton-docs-as-task/commit/1942d7fde169e38acf740981ce754027de339d27))
* **eslint:** migrate from tseslint.config() to defineConfig() ([4e002b5](https://github.com/josselinonduty/proton-docs-as-task/commit/4e002b5869cf33ce3c8f4c949e0b790061b7b6ae))
* import across folders through the @/ alias ([a643ac9](https://github.com/josselinonduty/proton-docs-as-task/commit/a643ac9f466d857f4be4a5408340685cebec4f89))
* **messaging:** type extension messages with @webext-core/messaging ([12bf78f](https://github.com/josselinonduty/proton-docs-as-task/commit/12bf78fe39679514913e320cef7588131350cbe7))
* **model:** split model.ts into a lib/model/ module per concern ([d928c7d](https://github.com/josselinonduty/proton-docs-as-task/commit/d928c7d1be89e32444e19edd66fc9dc368e61243))
* **overlay:** drive document sync through useBoardSession ([815ec11](https://github.com/josselinonduty/proton-docs-as-task/commit/815ec11a8a5039554f238abacefefa70eb649bf8))
* **overlay:** extract per-document session prefs into useSessionPrefs ([0754ec1](https://github.com/josselinonduty/proton-docs-as-task/commit/0754ec1db85d00bd9e3ec37aedcf5bb93d6bc1bf))
* **overlay:** register the popup command listener once ([c880128](https://github.com/josselinonduty/proton-docs-as-task/commit/c8801288586ffcab68195c500fbc5734b24b85f1))
* **styles:** put every stylesheet in explicit cascade layers ([7559a51](https://github.com/josselinonduty/proton-docs-as-task/commit/7559a51dac4a01529f509bbe5e011a50082e15a2))
* **styles:** split the board stylesheet into src/styles/board/ ([855ef8a](https://github.com/josselinonduty/proton-docs-as-task/commit/855ef8a47e99bd62035b18a3ace0023b6181453c))
* **sync:** add a React-free board session store ([229b699](https://github.com/josselinonduty/proton-docs-as-task/commit/229b699086c0f2b49e7b9e374e69f86568ff0494))


### Documentation

* **architecture:** describe the board session ([200fa78](https://github.com/josselinonduty/proton-docs-as-task/commit/200fa78aefca7bd2540594fec74b0215f38c0b3c))
* **architecture:** describe the board's layout, hooks and components ([2f2fc1f](https://github.com/josselinonduty/proton-docs-as-task/commit/2f2fc1f1dc0d0379d516dc9077e605e6096a6003))
* **architecture:** describe typed messaging and the bridge's editor watch ([fe5e67d](https://github.com/josselinonduty/proton-docs-as-task/commit/fe5e67d160a19c06f97dc5f6953f632c9b730827))
* describe native dialogs, the menu button and tab patterns ([53c3b15](https://github.com/josselinonduty/proton-docs-as-task/commit/53c3b15386b557496443f08a5a4241965baef3cb))
* describe the model modules, the @/ alias and the cascade layers ([4e159cc](https://github.com/josselinonduty/proton-docs-as-task/commit/4e159cc3df0db8b93fdda2e8e84586d81521dbbc))

## [1.2.1](https://github.com/josselinonduty/proton-docs-as-task/compare/v1.2.0...v1.2.1) (2026-10-24)


### Bug fixes

* **ci:** publish releases after attaching assets ([abc5c48](https://github.com/josselinonduty/proton-docs-as-task/commit/abc5c48c62bd53b8517e2bb7d0bd148f1dd51535))

## [1.2.0](https://github.com/josselinonduty/proton-docs-as-task/compare/v1.1.0...v1.2.0) (2026-10-24)


### Features

* **board:** manage statuses per document ([#59](https://github.com/josselinonduty/proton-docs-as-task/issues/59)) ([01f2e99](https://github.com/josselinonduty/proton-docs-as-task/commit/01f2e99cfc96985221122a3b34f88b9af41e8448))
* **board:** manage sub-tasks ([9c90207](https://github.com/josselinonduty/proton-docs-as-task/commit/9c9020705738c025825363a7c39e56738e5ea758)), closes [#40](https://github.com/josselinonduty/proton-docs-as-task/issues/40)
* **board:** open the full new task dialog from column footers ([87db8aa](https://github.com/josselinonduty/proton-docs-as-task/commit/87db8aa147b027f799618c2d492816f872345db3))
* **i18n:** add en, fr, de, es, it, ja, pt, nl and zh locales ([b0a179d](https://github.com/josselinonduty/proton-docs-as-task/commit/b0a179d0c9bfbc13e3fbd05e2b535b7e36e151b7)), closes [#42](https://github.com/josselinonduty/proton-docs-as-task/issues/42)
* **i18n:** add welcome and status flow translations ([5222e78](https://github.com/josselinonduty/proton-docs-as-task/commit/5222e78d60976104e940ae6cec682e3b7141f20e))
* **onboarding:** add layout presets for first-run setup ([d9dce46](https://github.com/josselinonduty/proton-docs-as-task/commit/d9dce4628002b1121831dfae9ee92695af981eaf))
* **options:** add status flow option and run setup link ([09a7176](https://github.com/josselinonduty/proton-docs-as-task/commit/09a717690f5dc145e4d2e185262946bc1ebef016))
* **options:** regroup settings into board, appearance, cards and behavior ([f3e68d3](https://github.com/josselinonduty/proton-docs-as-task/commit/f3e68d3f6e73788783c01462f407b92816e6d682))
* **statuses:** add selectable status flows for new boards ([a85ffa3](https://github.com/josselinonduty/proton-docs-as-task/commit/a85ffa337839914706b1eefc546c8447f31fce53))
* **welcome:** add a preferences step to first-run setup ([358d8ee](https://github.com/josselinonduty/proton-docs-as-task/commit/358d8ee132a4fa2a6cc983efa4764263e84bc775)), closes [#66](https://github.com/josselinonduty/proton-docs-as-task/issues/66)
* **welcome:** add first-run welcome page ([22144ba](https://github.com/josselinonduty/proton-docs-as-task/commit/22144ba45bf26126856286c49932ee5f7571516a))


### Bug fixes

* **board:** ignore parent links that loop back to the task ([1d07c4a](https://github.com/josselinonduty/proton-docs-as-task/commit/1d07c4a6b9b4cae7df782104a24a8cc8e57596d5))
* **board:** reset sub-task drafts when the panel switches task ([386b071](https://github.com/josselinonduty/proton-docs-as-task/commit/386b0715d3af71f22e753dfd216bc38370f882d4))
* **options:** align unhinted rows and wrap the header on narrow screens ([c7d8815](https://github.com/josselinonduty/proton-docs-as-task/commit/c7d88152d7d8d75887d806a525e5acea6bbff57b))
* **popup:** close after adding a task, configurable in options ([44ea255](https://github.com/josselinonduty/proton-docs-as-task/commit/44ea255b7ad6069351ed702830c140b7c799e3c6)), closes [#68](https://github.com/josselinonduty/proton-docs-as-task/issues/68)


### Refactoring

* **components:** extract shared hooks and page mounting ([9bbce11](https://github.com/josselinonduty/proton-docs-as-task/commit/9bbce114733e237cdd46b26d84e0eed5cafa3fb4))
* **i18n:** split language definitions and nest option labels ([d435ea5](https://github.com/josselinonduty/proton-docs-as-task/commit/d435ea5fc0b725f852482f5db6648a9bb513c0db))
* **settings:** centralize option lists and settings migration ([cebab84](https://github.com/josselinonduty/proton-docs-as-task/commit/cebab84764e619a1d2df74d9bc6faeb460be979f))
* **settings:** share appearance selects with first-run setup ([390a626](https://github.com/josselinonduty/proton-docs-as-task/commit/390a626bb36bf2f0df3cc5bfecb44cfc2962673f))


### Documentation

* add user guide, architecture and releasing docs ([e7a62d0](https://github.com/josselinonduty/proton-docs-as-task/commit/e7a62d07db5220f39082af9955e95a5fd183b224))
* **readme:** lead with screenshots and a two-step quick start ([6ae5ef4](https://github.com/josselinonduty/proton-docs-as-task/commit/6ae5ef46ac3b469af887c84b5f58c13ef3d5b32b))
* **readme:** link the published store listings for installation ([143e6e8](https://github.com/josselinonduty/proton-docs-as-task/commit/143e6e8a5982ea91128a9919181fddb427cf0747))
* **welcome:** document first-run setup and welcome prefix ([d1a0ad1](https://github.com/josselinonduty/proton-docs-as-task/commit/d1a0ad19c1c8b8405ef3f23a36f3ec4b690bc3d5))

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
