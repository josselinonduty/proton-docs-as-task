# Proton Docs as Task

Turn a [Proton Docs](https://proton.me/drive/docs) document into an interactive
**task board**. Open an empty document and one Proton-styled button converts it
into a board; open a document that already begins with an activation marker and
its checklist is parsed straight into a live board on top of the editor.

<p align="center">
  <img src="public/icon/128.png" width="96" height="96" alt="Proton Docs as Task icon" />
</p>

> The document is still the single source of truth — the board reads from it and
> writes back to it. You manage tasks, priorities, due dates and rich
> descriptions from the board UI, and never have to touch the text behind them.

A task's **status** (its workflow stage) and its **section** (the `## Heading`
it lives under) are independent. The board shows the same tasks in two layouts:

- **Workflow** — Kanban columns for the board's statuses (_To Do_, _In
  Progress_ and _Done_ unless you [define your own](#statuses)). Moving a card
  changes its status (and ticks/unticks its Markdown checkbox); its section is
  untouched.
- **Sections** — columns for the document's `## Headings`. Moving a card changes
  its section; its status is untouched. You can add, rename, reorder and delete
  sections here.
- **Swimlane** — a grid with status columns _and_ section rows at once. Drag a
  card sideways to change its status, up or down to change its section, or
  diagonally to change both.
- **List** — a simple checklist: every task in one flat list, tick to complete,
  click to open details. No columns and no drag-and-drop. Mark one section
  with `@default` (`## Inbox @default`, or the ✓ button in Sections view) to
  show only that section; with no mark it lists every task.

Switch views from the board header without ever changing your task data. Search
and filters (status, section, priority, assignee, label, due date, completion)
stay active across the switch, card and section moves can be **undone**, and
every move is announced for screen readers and reachable without a mouse
(`Alt`+`↑`/`↓` to reorder, or the explicit **Move** / **Move to…** controls).

---

## Working on the board

Beyond the two-way status/section model, the board is built for fast day-to-day
use. None of the features below change the Markdown — sorting, filters, density,
collapsed columns and view selection are **UI preferences**, remembered per
document for the current browser session only.

### Board layout

The header shows the board's title (the text after the activation marker) and
its progress (_4 of 12 done_). Cards are compact summaries — completion
checkbox, title, then priority, due date, labels and assignee. Click a card (or
focus it and press `Enter`) to open it in the **details panel** on the right,
where every field is edited; `Esc` closes the panel and puts focus back on the
card. Section names are renamed in place in the Sections view and saved on
`Enter` or when you leave the field (`Esc` cancels); a name that already
exists is refused rather than silently merging two sections.

### Quick capture

- **Add task** in the board header opens a compact form — only the title is
  required; status defaults to the first _Not started_ status and the section to
  the one you used last.
  `Cmd`/`Ctrl`+`Enter` (or `Enter` in the title) creates it; the new card is
  briefly highlighted, and if active filters would hide it you’re told and
  offered **Clear filters**. Every column keeps its own **+ Add task** too.
- The **extension popup** can add a task without opening the board: type a
  title, optionally pick a section and due date, and it writes straight into the
  active document — only reporting success once the write is confirmed.

### Sorting

Each view has a **Sort** menu — by due date, priority, title, assignee, recently
created, or back to **Manual order**. Sorting is non-destructive: it only changes
how cards are displayed, and switching back to Manual restores the saved document
order. Drag-and-drop is disabled while a non-manual sort is active; use **Apply
this order to document** to bake the current order in (undoable).

### Filters & presets

Active filters show as removable **chips** in the header, and one-click
**presets** cover the common cases — _My open tasks_ (once you set your name in
settings), _Overdue_, _Due this week_, _High priority_, _Unassigned_ and
_Recently completed_. Assignee and label inputs suggest values already used in
the document, with usage counts.

### Bulk actions

Enter **selection mode** (the ⋮ menu, `Space` on a focused card, or
`Cmd`/`Ctrl`+`A`), then select multiple cards — `Shift`-click selects a range
within a column. The toolbar can set status, section, priority, assignee or due
date, add or remove a label, mark complete, or delete — each as a **single,
undoable** document write. Destructive actions ask first.

### Swimlanes

**Swimlane** view crosses status (columns) with section (rows), so you can see
and move both dimensions at once. Rows collapse individually, empty
intersections stay valid drop targets, and a keyboard alternative (open the card
and use its Status/Section menus, or `M`) covers everyone who doesn’t drag.

### Keyboard & command palette

| Key                    | Action                          |
| ---------------------- | ------------------------------- |
| `N`                    | Open quick-add task             |
| `/`                    | Focus search                    |
| `F`                    | Open filters                    |
| `V`                    | Change board view               |
| `S`                    | Open sort menu                  |
| `J` / `K`              | Focus next / previous card      |
| `Enter`                | Open focused card's details     |
| `E`                    | Edit focused card's title       |
| `Space`                | Select focused card             |
| `X`                    | Toggle completion               |
| `M`                    | Move focused card (Section)     |
| `Delete` / `Backspace` | Delete selected card (confirm)  |
| `Cmd`/`Ctrl`+`Z`       | Undo last board action          |
| `Cmd`/`Ctrl`+`K`       | Open the command palette        |
| `Esc`                  | Close the active menu or dialog |
| `?`                    | Open the shortcut reference     |

Shortcuts don’t fire while you’re typing in a field (except the documented
submission shortcuts). The **command palette** (`Cmd`/`Ctrl`+`K`) exposes the
same actions — add a task, switch view, change sorting, clear filters, show/hide
completed, open settings, retry a failed save — searchable, with recently used
commands first.

### First-run setup

A fresh install opens a short **welcome page** with two questions: a **starting
layout** (_Simple list_, _Kanban board_ or _Swimlanes_, which sets the default
view, density and the card fields shown) and a **status flow** for new boards
(_To Do → Done_, _To Do → In Progress → Done_, or with an _In review_ step).
Everything is saved at the end in one step, skipping changes nothing, and each
choice stays an ordinary setting. The status flow is the **Statuses for new
boards** option and only applies when a blank document is converted; existing
boards keep their own statuses. Updates never show the page; use **Run setup
again** at the top of the options page to revisit it.

### Display preferences

The options page controls **card density** (comfortable / compact), which
**fields** cards show (description, priority, due date, assignee, labels, and the
section/status chips), how **completed tasks** are presented (shown, Done column
collapsed, or hidden — never removed from the document), the **date format**, and
**your name** for the _My open tasks_ filter.

---

## How it works

Proton Docs renders its content inside a sandboxed **Lexical** editor iframe
(`docs-editor.proton.me`) embedded in the Docs shell (`docs.proton.me`). This
extension:

1. **Bridges to Proton's editor.** A small script runs in the editor frame's
   own JavaScript world ([`src/lib/editorBridge.ts`](src/lib/editorBridge.ts))
   and attaches to the same Lexical editor instance Proton uses. It talks to
   the extension's content script through DOM events
   ([`src/lib/bridgeProtocol.ts`](src/lib/bridgeProtocol.ts)).
2. **Reads the editor state**, not the DOM: every Lexical update is serialized
   to plain text lines — headings, check-list items and their checked state —
   ([`src/lib/editorDoc.ts`](src/lib/editorDoc.ts)) and tagged with its origin
   (the board itself, a collaborator or another device, undo, or typing in
   Proton).
3. **Detects the activation marker** on the first non-empty line. If none is
   present but the document is empty, it offers a **Convert to task board**
   button; otherwise it stays completely dormant on that document.
4. **Parses** the rest into a task model ([`src/lib/parser.ts`](src/lib/parser.ts)).
5. **Renders** a React board inside a Shadow DOM overlay, so the extension's
   styles never leak into (or inherit from) Proton's UI.
6. **Writes edits back through Proton's own editor.** Each change is
   serialized ([`src/lib/model.ts`](src/lib/model.ts)), merged with anything
   that changed in the document meanwhile
   ([`src/lib/lineMerge.ts`](src/lib/lineMerge.ts)), and applied as one tagged
   Lexical update that touches only the blocks that changed — `## Section`
   becomes a real heading and tasks real check-list items. Proton's Yjs
   collaboration, history and saving then handle it exactly like typed text,
   so edits from two devices merge instead of overwriting each other.
7. **Follows the document live.** Changes made anywhere else appear on the
   open board immediately; if Proton has editing locked (loading, offline,
   view-only), board edits wait and are written once it unlocks.

```
docs.proton.me  (outer shell frame)
└── iframe: docs-editor.proton.me   ◄── content scripts run here
    ├── [data-lexical-editor] …     ── Proton's Lexical editor (+ Yjs sync)
    │     ▲ editor.update / update listener
    ├── editor bridge (page world)  ── reads state, applies board edits
    │     ▲ DOM CustomEvents
    └── #shadow-root (pdt-host)      ── React board overlay (isolated world)
```

Everything runs locally in the browser. The extension requests only the
`storage` permission (for your settings) and host access to the two Proton Docs
origins. It makes **no network requests** and reads nothing beyond the document
you have open.

## Task syntax

A document activates when its **first non-empty line** starts with one of the
activation markers (default `#!tasks`, `#!task`, or `:::tasks`). You can add a
board title after the marker.

```text
#!tasks Sprint 42

## Backend
- [x] Design the schema @who:sam
- [ ] Build the API @status:doing @priority:high @due:2026-09-10 #api

## Frontend
- [ ] Wire up the board @@jo !!
- [ ] Polish styles #ui
```

| Token                                  | Meaning                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `- [ ]` / `- [x]`                      | An open / done task (plain `- bullets` work too)                                                         |
| `## Heading`                           | A section — the Sections view groups by these                                                            |
| `@status:doing`                        | Status, by key (built-in shorthands like `@s:wip` or `in-progress` map to a status with that key)        |
| `@priority:high`                       | Priority: `high` · `medium` · `low` (or `!` / `!!` / `!!!`)                                              |
| `@due:2026-09-10`                      | A due date (`@due(next friday)` also works)                                                              |
| `@who:alex` / `@@alex`                 | An assignee                                                                                              |
| `@id:key` `@blocks:key,key` `@rel:key` | Task links, managed from the task panel (a blocked task stays _Not started_ until its blockers are done) |
| `@parent:key`                          | Makes the task a sub-task of the one marked `@id:key` (see [Sub-tasks](#sub-tasks))                      |
| `@desc(free text)`                     | A hidden single-line description (managed from the board, escaped to round-trip)                         |
| `#label`                               | One or more labels                                                                                       |

A ticked checkbox always resolves to a **Done** status; otherwise an explicit
`@status` applies, and everything else gets the first **Not started** status.
See [`examples/sample-board.md`](examples/sample-board.md) for a fuller example,
and the extension's **options page** for an in-app syntax guide.

### Sub-tasks

Any task can be broken down into **sub-tasks**. A sub-task is an ordinary task
— its own card, status, section, priority and everything else — that points at
its parent with `@parent:key`; the parent carries the matching `@id:key`:

```text
## Backend
- [ ] Ship the API @id:k3p9
- [x] Design endpoints @parent:k3p9
- [ ] Write handlers @parent:k3p9 @id:x8m2
- [ ] Pagination @parent:x8m2
```

- **Create** a sub-task from the parent's details panel (_Add a sub-task…_,
  `Enter`): it lands in the parent's section, right after its siblings, in
  the first _Not started_ status.
- **Read** it on the board: a parent card shows its progress (`1/2`), a
  sub-task card names its parent, and the details panel lists both.
- **Update** it like any other task — open it from the list, tick it in place,
  or move it under another parent (_Parent task_ search) or detach it.
- **Delete** it from the parent's list (with the usual confirmation), or
  **detach** it to keep it as a standalone task. Deleting a parent keeps its
  sub-tasks and simply detaches them.

Nesting has no depth limit, and a move that would make a task its own
ancestor is refused. **A parent can't be completed while any sub-task below
it, at any depth, is still open** — the Done statuses and checkbox are
disabled and the board explains which sub-tasks are in the way. Keys are
written and cleaned up by the board; you never type them yourself.

### Statuses

Each board defines its own statuses, stored in the document right below the
activation marker — one `@settings status` line each, in column order:

```text
#!tasks Sprint 42
@settings status todo "To Do" @category:todo
@settings status doing "In Progress" @category:doing @color:blue @bg:blue
@settings status review "In review" @category:doing @color:#6d4aff @bg:#efeaff
@settings status done "Done" @category:done @color:green
```

- The **key** (`review`) is what task lines reference (`@status:review`). It's
  set once, from the label, so **renaming** a status never rewrites a task.
- The **category** gives a status its meaning: `todo` (_Not started_), `doing`
  (_In progress_) or `done`. Any Done status ticks the task's checkbox and
  counts as completed; the first Done status is what ticking a checkbox
  picks, and the first Not started one is where new tasks land. A board always
  keeps at least one of each.
- **Colours** are optional: `@color` for the text, `@bg` for the background,
  either a theme-aware swatch (`grey`, `purple`, `blue`, `green`, `orange`,
  `red`) or a hex value. They colour the column header and tint the column.

Manage them from **Board settings** (the board's ⋮ menu or the command
palette): add, rename, change category or colours, reorder (drag and drop or
`Alt`+`↑`/`↓`) and delete — deleting a status that still has tasks asks where
to move them. Workflow column headers offer the same rename, reorder, colour
and delete controls, plus an **Add status** column.

A board without `@settings status` lines uses _To Do_ / _In Progress_ /
_Done_; those are written into the document with the board's first edit, never
just by opening it. If a task references a status the board doesn't define
(removed elsewhere, or typed by hand), the board shows a blocking dialog until
those tasks are moved to an existing status — or the status is created again
from Board settings.

## Install from a release

Prebuilt packages are attached to every
[GitHub Release](https://github.com/josselinonduty/proton-docs-as-task/releases).
Grab the latest one — no build tools required.

**Chrome / Chromium / Edge**

1. Download `proton-docs-as-task-<version>-chrome.zip` and **unzip it** (Chrome
   can't load a zip directly).
2. Open `chrome://extensions` and enable **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.

**Firefox**

1. Download `proton-docs-as-task-<version>-firefox.zip`.
2. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on** and
   pick the downloaded zip.

> On Firefox, an unsigned add-on loaded this way is **temporary** — it's removed
> when you restart the browser. A permanent install requires signing through
> addons.mozilla.org, which isn't set up for this project yet.

Once loaded, open a document on `docs.proton.me`, make its first line `#!tasks`,
and add a few `- [ ]` items.

## Install & develop

Requires Node 22+ (Node 24 is used in CI). See [CONTRIBUTING.md](CONTRIBUTING.md)
for the full contributor workflow.

```bash
npm install          # install deps (runs `wxt prepare`)
npm run dev          # launch Chrome with the extension + HMR
npm run dev:firefox  # launch Firefox instead
npm run playground   # board UI only, against a fake document (no extension)
```

The **playground** (`playground/`, dev-only, never part of the extension build)
mounts the real board overlay against an in-memory document at
<http://localhost:5199>. It can simulate a collaborator's edit and a locked
(offline) editor, and `?empty` opens an empty document. Use it to iterate on UI
and to run usability sessions without loading the extension into Proton.

To load a production build manually:

```bash
npm run build            # → .output/chrome-mv3
npm run build:firefox    # → .output/firefox-mv2
```

Then in Chrome open `chrome://extensions`, enable **Developer mode**, and
**Load unpacked** → select `.output/chrome-mv3`. In Firefox use
`about:debugging` → **Load Temporary Add-on** → pick any file in
`.output/firefox-mv2`.

Open a document on `docs.proton.me`, make its first line `#!tasks`, and add a few
`- [ ]` items.

### Scripts

| Command                           | Description                                                   |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run dev` / `dev:firefox`     | Dev server with hot reload                                    |
| `npm run playground`              | Board UI against a fake document, in any browser              |
| `npm run build` / `build:firefox` | Production build                                              |
| `npm run zip` / `zip:firefox`     | Zip a build for release / distribution                        |
| `npm run submit`                  | Submit built zips to the extension stores (needs credentials) |
| `npm run submit:init`             | Interactively generate store credentials into `.env.submit`   |
| `npm run compile`                 | Type-check with `tsc --noEmit`                                |
| `npm run lint`                    | Lint with ESLint                                              |
| `npm run format` / `format:check` | Format (or check) with Prettier                               |
| `npm test`                        | Run the unit tests (Vitest)                                   |

### Releasing

Releases are automated with [release-please][release-please]. Commits on
`main` follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix                                         | Effect                           |
| ---------------------------------------------- | -------------------------------- |
| `fix:`                                         | patch bump (`0.7.1` → `0.7.2`)   |
| `feat:`                                        | minor bump (`0.7.1` → `0.8.0`)   |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` footer | minor while `0.x`, major from 1+ |
| `perf:`, `refactor:`, `docs:`                  | listed in the changelog          |
| `chore:`, `ci:`, `build:`, `test:`, `style:`   | no release, not in the changelog |

The [`release-please` workflow](.github/workflows/release-please.yml) keeps a
standing **"chore(main): release X.Y.Z"** pull request open against `main`. It
accumulates everything merged since the last release, bumps the version in
`package.json` / `package-lock.json` (WXT uses it for the manifest version) and
prepends the new section to `CHANGELOG.md`. Nothing is released until you merge
that PR; merging it creates the `vX.Y.Z` tag and GitHub Release, then calls the
[`release` workflow](.github/workflows/release.yml). Use squash merges (or
conventional merge titles) so the PR title is the commit that gets parsed.

The `release` workflow type-checks, tests, builds the Chrome and Firefox
packages, and attaches them (plus a Firefox sources archive) to that GitHub
Release. It can also be re-run by hand from the Actions tab with an existing
tag, e.g. `v0.8.0`.

One-time repository setup: enable **Settings → Actions → General → Allow GitHub
Actions to create and approve pull requests**. PRs opened by the default
`GITHUB_TOKEN` don't trigger CI; to get checks on the release PR, add a
`RELEASE_PLEASE_TOKEN` secret (a PAT or GitHub App token with contents and
pull-requests write).

[release-please]: https://github.com/googleapis/release-please

If the store credentials below are configured as repository secrets, the
workflow also submits the packages to the Chrome Web Store and Firefox
Add-ons (AMO) for review, using [`wxt submit`][wxt-submit] (backed by
[`publish-browser-extension`][pbe]). Submission is skipped — without failing
the release — for whichever store's secrets aren't set, so the GitHub
Release always publishes even before the stores are wired up.

#### Store credentials

| Secret                                | Store   | Where to get it                                                                                                              |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `CHROME_EXTENSION_ID`                 | Chrome  | The extension's ID on the [Chrome Web Store Developer Dashboard][chrome-dashboard] (create the listing once, by hand, first) |
| `CHROME_PUBLISHER_ID`                 | Chrome  | From the dashboard URL after selecting your publisher account                                                                |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | Chrome  | `client_email` from a [Google Cloud service account][gcp-service-accounts] JSON key                                          |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`  | Chrome  | `private_key` from the same JSON key                                                                                         |
| `FIREFOX_EXTENSION_ID`                | Firefox | The add-on's ID/slug on [addons.mozilla.org][amo-devhub] (create the listing once, by hand, first)                           |
| `FIREFOX_JWT_ISSUER`                  | Firefox | `JWT issuer` from your [AMO API keys][amo-api-keys]                                                                          |
| `FIREFOX_JWT_SECRET`                  | Firefox | `JWT secret` from the same page                                                                                              |

Chrome submission uses Web Store API **v2** (service account auth) — the
workflow sets `CHROME_API_VERSION=v2` itself, it isn't a secret. The older
v1.1 OAuth flow (client ID/secret/refresh token) still works but is
deprecated and stops working October 15th, 2026.

Run `npm run submit:init` locally to walk through generating these values
interactively (it writes them to a git-ignored `.env.submit` file); copy the
results into the repository's **Settings → Secrets and variables → Actions**.
Only create the store listings themselves once, by hand — `wxt submit`
uploads new versions to an existing listing, it doesn't create one.

[wxt-submit]: https://wxt.dev/guide/essentials/publishing.html
[pbe]: https://github.com/aklinker1/publish-browser-extension
[chrome-dashboard]: https://chrome.google.com/webstore/devconsole
[gcp-service-accounts]: https://developer.chrome.com/docs/webstore/service-accounts
[amo-devhub]: https://addons.mozilla.org/developers/
[amo-api-keys]: https://addons.mozilla.org/developers/addon/api/key/

## Configuration

Open the extension's **options page** (right-click the toolbar icon → _Options_,
or the "Settings & syntax guide" link in the popup) to:

- enable / disable the extension and choose whether activated boards open
  automatically,
- pick the default view (Workflow, Sections, Swimlane or List), theme (System / Light /
  Dark) and card density (Comfortable / Compact),
- choose the **language** — English, French, German, Spanish, Italian, Japanese,
  Portuguese, Dutch or Chinese — or follow the browser's (the default). Only the
  extension's own UI is translated; what the document stores (the `Tasks` section,
  the default `To Do` / `In Progress` / `Done` statuses) stays as written,
- tune board behavior — new cards at top or bottom, description previews,
  confirm-before-delete, and whether the popup closes after you add a task,
- set **display preferences** — which fields cards show, how completed tasks are
  presented (shown / Done collapsed / hidden), the date format, and your own name
  for the _My open tasks_ filter,
- customize the activation markers (an empty marker list is rejected).

Settings are stored in `browser.storage.sync`, and a v0.4 or v0.5 board opens
with no manual migration. Statuses aren't an extension setting: each board
keeps its own in the document (see [Statuses](#statuses)).

## Project layout

```
src/
├─ entrypoints/
│  ├─ background.ts              # opens options on first install
│  ├─ editor-bridge.content.ts   # page-world script: Proton's Lexical editor
│  ├─ proton-task.content/       # content script + board overlay + styles
│  ├─ popup/                      # toolbar popup (status + quick toggles)
│  └─ options/                    # settings & syntax guide
├─ i18n/                          # i18next setup + locales/*.json (en is the source)
├─ components/                    # React board UI (OverlayApp, EditableBoard,
│                                 #   EditableTaskCard, QuickAddForm, SortMenu,
│                                 #   FilterBar/FilterPanel, BulkBar, Combobox,
│                                 #   LabelInput, DueDateControl, CommandPalette,
│                                 #   ShortcutHelp, Dialog) — with interaction tests
└─ lib/
   ├─ parser.ts                   # marker detection + task DSL parser    (tested)
   ├─ model.ts                    # flat task model, views, serialization,
   │                              #   bulk actions                        (tested)
   ├─ filters.ts                  # search, filters, exclude, presets     (tested)
   ├─ sorting.ts                  # non-destructive sort + apply-to-doc   (tested)
   ├─ dates.ts                    # due-date shortcuts + display states   (tested)
   ├─ suggestions.ts              # assignee / label autocomplete indexes (tested)
   ├─ session.ts / sessionStore.ts# per-document session preferences      (tested)
   ├─ sync.ts                     # canonical compare + task id reconcile (tested)
   ├─ board.ts                    # grouping + summary helpers            (tested)
   ├─ editorDoc.ts                # Lexical state ↔ lines, minimal edits  (tested)
   ├─ lineMerge.ts                # LCS + three-way line merge            (tested)
   ├─ editorBridge.ts             # page-world editor bridge (real Lexical +
   │                              #   Yjs tests)                          (tested)
   ├─ editorClient.ts / bridgeProtocol.ts # content-script ↔ bridge contract
   ├─ settings.ts / defaults.ts   # persisted settings
   ├─ platform.ts                 # OS-aware shortcut labels
   ├─ messaging.ts                # popup ↔ content-script contract
   └─ types.ts
```

## Scope & limitations

- **The board reads from and writes back to the document** — through Proton's
  own Lexical editor, so Proton's sync and saving carry every change. The board
  follows the document live: edits made elsewhere (another device, a
  collaborator, the editor itself) show up on the open board, and concurrent
  edits are merged rather than overwritten. Proton shows its own save status;
  the board header only flags a failed write (with **Retry**) or edits
  _waiting to save_ while Proton has editing locked.
- The board writes `## Sections` as headings and tasks as native check-list
  items. A board written by an older version (plain-text lines) is converted
  to these native blocks the first time the board edits it; the text stays the
  same.
- The editor bridge relies on Lexical internals Proton doesn't control
  (`__lexicalEditor`, the node registry), and needs Chrome 111+ or Firefox
  128+ for page-world content scripts.
- **Out of scope for v0.6:** custom workflow statuses, comments, attachments,
  subtasks, recurring tasks, reminders/notifications, task dependencies, estimates
  or time tracking, saved custom filter sets, shared user profiles, Proton
  Contacts integration, cross-document dashboards, real-time multi-user merge, and
  any cloud/back-end service. Everything runs locally, and natural-language date
  parsing is not attempted — date shortcuts resolve to exact calendar dates.
- Built with [WXT](https://wxt.dev), React and TypeScript.

## Privacy & security

[PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md) — the extension makes
no network requests and collects no data; everything runs locally.

## License

[MIT](LICENSE) © josselinonduty

This project is an independent, unofficial tool and is not affiliated with or
endorsed by Proton AG. "Proton" and "Proton Docs" are trademarks of Proton AG.
