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
   ([`model.ts`](../src/lib/model.ts)), three-way merged with whatever changed
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
│                                 #   filters, command palette, sub-tasks, board settings…
│                                 #   and hooks (useBoardSession, usePopupCommands, useSessionPrefs)
├─ i18n/                          # i18next setup and locales/*.json (en is the source)
├─ styles/                        # shared design tokens and components (see STYLEGUIDE.md)
└─ lib/
   ├─ parser.ts                   # marker detection and task syntax
   ├─ model.ts                    # task model, views, edits, serialisation, bulk actions
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

Logic in `src/lib` and the interactive components have unit tests next to them
(`*.test.ts(x)`).

## Limitations

- The editor bridge relies on Lexical internals Proton doesn't control
  (`__lexicalEditor`, the node registry). A Proton update can break it until
  the extension is updated. It needs Chrome 111+ or Firefox 128+ for
  page-world content scripts.
- A board written by a version before 1.0 (plain-text lines) is converted to
  native headings and check-list items the first time the board edits it; the
  text stays the same.
- Proton shows its own save status. The board header only flags a failed write
  (with **Retry**) or edits waiting while editing is locked.
- Not supported: comments, attachments, recurring tasks, reminders or
  notifications, estimates and time tracking, saved custom filters,
  cross-document dashboards, and Proton Contacts integration. Due dates are
  exact calendar dates; natural-language dates are not parsed.
