# Proton Docs as Task

Turn a [Proton Docs](https://proton.me/drive/docs) document into an interactive
**task board**. Open an empty document and one Proton-styled button converts it
into a board; open a document that already begins with an activation marker and
its checklist is parsed straight into a live Kanban view on top of the editor.

<p align="center">
  <img src="public/icon/128.png" width="96" height="96" alt="Proton Docs as Task icon" />
</p>

> The document is still the single source of truth — the board reads from it and
> writes back to it. You manage columns, tasks, priorities, due dates and rich
> descriptions from the board UI, and never have to touch the text behind them.

---

## How it works

Proton Docs renders its content inside a sandboxed **Lexical** editor iframe
(`docs-editor.proton.me`) embedded in the Docs shell (`docs.proton.me`). This
extension:

1. **Injects a content script** into that editor frame.
2. **Reads the editor DOM** and serializes it to plain text, preserving
   headings, checkboxes and list items (see [`src/lib/extractor.ts`](src/lib/extractor.ts)).
   It keys off structural attributes Lexical emits (`role="checkbox"`,
   `aria-checked`, `<h1..6>`) rather than Proton's CSS class names, so it keeps
   working across styling changes.
3. **Detects the activation marker** on the first non-empty line. If none is
   present but the document is empty, it offers a **Convert to task board**
   button; otherwise it stays completely dormant on that document.
4. **Parses** the rest into a task model ([`src/lib/parser.ts`](src/lib/parser.ts)).
5. **Renders** a React board inside a Shadow DOM overlay, so the extension's
   styles never leak into (or inherit from) Proton's UI.
6. **Writes edits back** to the document. While the board is open it is
   authoritative: each change is serialized to plain text
   ([`src/lib/model.ts`](src/lib/model.ts)) and pushed into the Lexical editor
   ([`src/lib/docwriter.ts`](src/lib/docwriter.ts)). The board rebuilds from the
   freshly parsed document each time you reopen it.

```
docs.proton.me  (outer shell frame)
└── iframe: docs-editor.proton.me   ◄── content script runs here
    ├── [data-lexical-editor] …     ── read + observed via MutationObserver
    └── #shadow-root (pdt-host)      ── React board overlay is mounted here
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

| Token                  | Meaning                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `- [ ]` / `- [x]`      | An open / done task (plain `- bullets` work too)                                   |
| `## Heading`           | A section — used by the "group by section" view                                    |
| `@status:doing`        | Status: `todo` · `doing` · `done` (aliases: `@s:wip`, `backlog`, `in-progress`, …) |
| `@priority:high`       | Priority: `high` · `medium` · `low` (or `!` / `!!` / `!!!`)                        |
| `@due:2026-09-10`      | A due date (`@due(next friday)` also works)                                        |
| `@who:alex` / `@@alex` | An assignee                                                                        |
| `@desc(free text)`     | A hidden single-line description (managed from the board, escaped to round-trip)   |
| `#label`               | One or more labels                                                                 |

An explicit `@status` always wins; otherwise a ticked checkbox resolves to
**done** and everything else to **todo**. See
[`examples/sample-board.md`](examples/sample-board.md) for a fuller example, and
the extension's **options page** for an in-app syntax guide.

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
```

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

| Command                           | Description                            |
| --------------------------------- | -------------------------------------- |
| `npm run dev` / `dev:firefox`     | Dev server with hot reload             |
| `npm run build` / `build:firefox` | Production build                       |
| `npm run zip` / `zip:firefox`     | Zip a build for release / distribution |
| `npm run compile`                 | Type-check with `tsc --noEmit`         |
| `npm run lint`                    | Lint with ESLint                       |
| `npm run format` / `format:check` | Format (or check) with Prettier        |
| `npm test`                        | Run the unit tests (Vitest)            |

### Releasing

Releases are built and published by the
[`release` workflow](.github/workflows/release.yml) when a version tag is
pushed:

1. Bump `version` in `package.json` (WXT uses it for the manifest version).
2. Commit the bump.
3. Tag and push:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

The workflow type-checks, tests, builds the Chrome and Firefox packages, and
attaches them to a new GitHub Release with auto-generated notes. The tag must
match the `package.json` version (e.g. `v0.1.0` ↔ `0.1.0`) or the run fails.

## Configuration

Open the extension's **options page** (right-click the toolbar icon → _Options_,
or the "Settings & syntax guide" link in the popup) to:

- enable / disable the extension,
- customize the activation markers,
- rename the status columns,
- choose the default grouping (status vs. section) and auto-show behavior.

Settings are stored in `browser.storage.sync`.

## Project layout

```
src/
├─ entrypoints/
│  ├─ background.ts              # opens options on first install
│  ├─ proton-task.content/       # content script + board overlay + styles
│  ├─ popup/                      # toolbar popup (status + quick toggles)
│  └─ options/                    # settings & syntax guide
├─ components/                    # React board UI (Board, TaskCard, OverlayApp)
└─ lib/
   ├─ parser.ts                   # marker detection + task DSL parser  (tested)
   ├─ board.ts                    # grouping + summary helpers           (tested)
   ├─ extractor.ts                # Lexical DOM → text serialization
   ├─ settings.ts / defaults.ts   # persisted settings
   ├─ messaging.ts                # popup ↔ content-script contract
   └─ types.ts
```

## Scope & limitations

- **v1 is a read / visualize layer.** Proton Docs is end-to-end encrypted and
  edited through a collaborative (Yjs) model, so this extension deliberately does
  **not** write back into the document — it never risks corrupting your data.
  You edit tasks by editing the doc; the board reflects it live.
- Because it depends on the editor's DOM structure, a major redesign of the
  Proton Docs editor could require updating the selectors in `extractor.ts`.
- Built with [WXT](https://wxt.dev), React and TypeScript.

## License

[MIT](LICENSE) © josselinonduty

This project is an independent, unofficial tool and is not affiliated with or
endorsed by Proton AG. "Proton" and "Proton Docs" are trademarks of Proton AG.
