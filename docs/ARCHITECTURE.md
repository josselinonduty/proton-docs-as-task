# How it works

Proton Docs renders documents in a sandboxed **Lexical** editor iframe
(`docs-editor.proton.me`) inside the Docs shell (`docs.proton.me`). The
extension:

1. **Bridges to Proton's editor.** A small script runs in the editor frame's own
   JavaScript world ([`editorBridge.ts`](../src/lib/editorBridge.ts)) and
   attaches to the Lexical editor Proton uses, re-attaching when Proton
   remounts it (it watches the DOM, it doesn't poll). It talks to the content
   script through DOM events ([`bridgeProtocol.ts`](../src/lib/bridgeProtocol.ts));
   any page script can fire those, so both sides check each payload's shape
   and drop the rest.
2. **Reads the editor state**, not the DOM. Each Lexical update is turned into
   plain text lines (headings, check-list items and their checked state) by
   [`editorDoc.ts`](../src/lib/editorDoc.ts), and tagged with its origin: the
   board, a collaborator or other device, undo, or typing in Proton.
3. **Detects the activation marker** on the first non-empty line. An empty
   document gets a **Create task board** button; any other document is left
   alone.
4. **Parses** the rest into a task model ([`parser.ts`](../src/lib/parser.ts)).
5. **Renders** a React board in a Shadow DOM overlay, so its styles never leak
   into Proton's UI, or the reverse.
6. **Writes edits back through Proton's editor.** Each change is serialised
   ([`model/`](../src/lib/model/index.ts)), three-way merged with whatever changed
   in the document meanwhile ([`lineMerge.ts`](../src/lib/lineMerge.ts)), and
   applied as one tagged Lexical update that touches only the changed blocks.
   `## Sections` become real headings and tasks real check-list items. Proton's
   Yjs collaboration, history and saving then treat it like typed text.
7. **Follows the document live.** Changes made anywhere else appear on the open
   board. While Proton has editing locked (loading, offline, view-only), board
   edits wait and are written once it unlocks.

Steps 6 and 7 live in the **board session**
([`boardSession.ts`](../src/lib/boardSession.ts)), a small store with no React
in it: it holds the board shown, the pending edit and the merge base,
debounces writes, handles each editor state by its origin, and offers retry,
reload and undo. `OverlayApp` reads it with `useSyncExternalStore`
([`useBoardSession`](../src/components/useBoardSession.ts)) and only renders
the board and answers the popup.

```
docs.proton.me  (outer shell frame)    ◄── shell-branding: favicon while a board is open
└── iframe: docs-editor.proton.me      ◄── content scripts run here
    ├── [data-lexical-editor] …        ── Proton's Lexical editor (+ Yjs sync)
    │     ▲ editor.update / update listener
    ├── editor bridge (page world)     ── reads state, applies board edits
    │     ▲ DOM CustomEvents
    └── #shadow-root (pdt-host)        ── React board overlay (isolated world)
```

The content scripts also load in the Docs shell frame. Without an editor
there, the board never mounts: the content script asks the bridge a few times,
backing off, then waits for the bridge to announce an editor.

The popup and the background talk to the content script through typed
extension messages ([`messaging.ts`](../src/lib/messaging.ts), one
`ProtocolMap` on [`@webext-core/messaging`](https://webext-core.aklinker1.io/messaging/installation)):
the popup asks the tab for the board's status, shows or hides it, and adds
tasks; the board asks the background to open the options page. A tab message
reaches every frame, and the first answer wins. Only the editor frame
registers the popup's handlers, so it is the one that answers; a tab with no
board rejects, which the popup treats as "no board here".

Everything runs locally. The extension asks only for the `storage` permission
(settings) and host access to the two Proton Docs origins. It makes **no
network requests** and reads nothing beyond the open document.

## Project layout

```
src/
├─ entrypoints/
│  ├─ background.ts               # opens the welcome page on install; opens options for the board
│  ├─ editor-bridge.content.ts    # page-world script: Proton's Lexical editor
│  ├─ shell-branding.content.ts   # shell frame: app icon while a board is open
│  ├─ proton-task.content/        # content script, board overlay and styles
│  ├─ popup/                      # toolbar popup: status, quick add, show/hide board
│  ├─ options/                    # settings page
│  └─ welcome/                    # first-run setup: layout, status flow, preferences
├─ components/                    # React UI: OverlayApp, EditableBoard, cards, dialogs,
│  │                              #   filters, command palette, sub-tasks, board settings…
│  │                              #   and hooks (useBoardSession, usePopupCommands, useSessionPrefs)
│  └─ board/                      # EditableBoard's pieces (see below)
├─ i18n/                          # i18next setup and locales/*.json (en is the source)
├─ styles/                        # design tokens, shared components and the board's
│                                 #   stylesheets in board/ (see STYLEGUIDE.md)
└─ lib/
   ├─ parser.ts                   # marker detection and task syntax
   ├─ model/                      # task model, one module per concern (see below)
   ├─ statuses.ts                 # per-board statuses, flows and @settings lines
   ├─ filters.ts / sorting.ts     # search, filters, presets; display-only sorting
   ├─ dates.ts / suggestions.ts   # due-date states; assignee and label suggestions
   ├─ board.ts / sync.ts          # grouping and summaries; task identity across edits
   ├─ session.ts / sessionStore.ts# per-document display preferences
   ├─ editorDoc.ts                # Lexical state ↔ lines, minimal edits
   ├─ editorBridge.ts             # page-world bridge (tested against real Lexical + Yjs)
   ├─ editorClient.ts / bridgeProtocol.ts  # content script ↔ bridge contract
   ├─ lineMerge.ts                # LCS and three-way line merge
   ├─ boardSession.ts             # board ↔ document sync: pending edits, debounced writes
   ├─ settings.ts / defaults.ts   # stored settings and migrations
   ├─ onboarding.ts               # first-run layouts and presets
   ├─ branding.ts / platform.ts   # shell icon; OS-aware shortcut labels
   ├─ messaging.ts                # popup / background ↔ content script messages
   └─ types.ts
playground/                       # dev-only harness: real UI on a fake Proton page
scripts/generate-screenshots      # store and README images from the playground
```

### The board

`EditableBoard` owns the open board's UI state and actions; its pieces live in
[`components/board/`](../src/components/board):

- **Layout.** [`layoutBoard()`](../src/components/board/boardLayout.ts) is a
  pure function of the model, view, filters, sort and collapsed columns: the
  columns or swimlane rows, the cards each shows, the keyboard order (J / K)
  and each card's place in its column. The board memoises it, and rendering,
  shortcuts and the details panel all read the same result.
- **State hooks.** `useBoardOverlay` holds the one modal open at a time (quick
  add, a delete confirmation, Board settings, shortcut help) as a
  discriminated union. The command palette and the status delete confirmation
  stack on top of it, so they're separate. `useBoardSelection`,
  `useDetailsNavigation` (the panel and its Back trail) and `useBoardDnd` hold
  the rest; `useTaskActions` turns card edits and drops into model changes.
- **Shortcuts.** [`shortcuts.ts`](../src/components/board/shortcuts.ts) is a
  key map: each entry names its keys, modifiers, whether it fires while typing
  or over a dialog, a guard and an action. `useBoardShortcuts` matches key
  presses against it, and the shortcut help is generated from it.
- **Components.** `BoardHeader` (with `BoardMenu`), `BoardColumns` and
  `BoardColumn` (Workflow, Sections, List), `BoardSwimlane`, `BoardCard`,
  `BoardDetails` and `BoardConfirmDialogs`. They read the board and its
  actions from `BoardContext`.
- **Dialogs, menus and tabs.** Every modal goes through
  [`Modal`](../src/components/Modal.tsx) (and `Dialog`, its titled panel): a
  native `<dialog>` opened with `showModal()`. The browser puts it in the top
  layer, makes the rest of the page inert and draws `::backdrop`, so stacking
  follows opening order: the status delete confirmation or the palette opened
  over Board settings lands on top, and Escape (handled by the dialog, after
  any nested control had its chance) closes only that one. Focus goes to the
  first control or `initialFocus`, and back to what had it on close. The
  board and sort menus follow the menu button pattern through
  [`useMenuButton`](../src/components/useMenuButton.ts) (arrow keys,
  Home / End, Escape and Tab return to the button; an item closes the menu
  before it acts, so a dialog it opens returns focus to the button). The view
  switcher is a tablist with a roving tab stop over the board's tabpanel. Both
  move focus with [`moveFocus`](../src/components/rovingFocus.ts). Menus and
  popovers stay positioned under their trigger and close on outside clicks
  through `useDismiss`, not the Popover API (see Limitations).

### The model

[`lib/model/`](../src/lib/model) holds the editable board model as pure
functions: each takes a model and returns a new one. `index.ts` is the public
API; import from `@/lib/model`, not from a module. The modules:

- `types.ts`: `BoardModel`, `BoardTask`, `BoardColumn`.
- `create.ts`: ids, new tasks, the starter board and `fromParseResult`.
- `views.ts`: `columnsForView`, the model projected into a view's columns.
- `sections.ts` and `tasks.ts`: the title, sections, and task edits and moves.
- `links.ts` and `subtasks.ts`: blocking and related links, sub-tasks, and the
  status rules that follow from them (`canSetStatus`).
- `bulk.ts`: the selection's bulk actions and `countTasks`.
- `statuses.ts`: adding, editing, moving and removing statuses.
- `serialize.ts`: the model back to document text.
- `internal.ts`: helpers the modules share (`reindex`, task keys); not exported.

Logic in `src/lib` and the interactive components have unit tests next to them
(`*.test.ts(x)`). Tests import `describe`, `it`, `vi`… from `vitest`: the
global test types aren't loaded, so production code can't use them.

Imports that leave their folder go through the `@/` alias (`@/` is `src/`, set
up by WXT, Vitest and the playground); same-folder imports stay relative. See
[STYLEGUIDE.md](../STYLEGUIDE.md#imports).

## Limitations

- The editor bridge relies on Lexical internals Proton doesn't control
  (`__lexicalEditor`, the node registry). A Proton update can break it until
  the extension is updated. It needs Chrome 111+ or Firefox 128+ for
  page-world content scripts.
- Menus and popovers don't use the Popover API: it would raise the Chrome
  floor to 114 for no gain, since a popover in the top layer would still need
  script positioning under its trigger (Firefox 128 has no CSS anchor
  positioning). They stay absolutely positioned and close through
  `useDismiss`. Modal dialogs use native `<dialog>`, which both floors
  support.
- A board written by a version before 1.0 (plain-text lines) is converted to
  native headings and check-list items the first time the board edits it; the
  text stays the same.
- Proton shows its own save status. The board header only flags a failed write
  (with **Retry**) or edits waiting while editing is locked.
- Not supported: comments, attachments, recurring tasks, reminders or
  notifications, estimates and time tracking, saved custom filters,
  cross-document dashboards, and Proton Contacts integration. Due dates are
  exact calendar dates; natural-language dates are not parsed.
