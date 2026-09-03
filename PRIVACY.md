# Privacy Policy

**Proton Docs as Task** is a browser extension that runs entirely on your
device. It does not collect, store, transmit, or sell any personal data, and
it has no server of its own.

## What the extension does

- It reads the DOM of the Proton Docs editor (`docs.proton.me` and
  `docs-editor.proton.me` only) to parse a document's checklist into a task
  board, and writes edits back into that same document as plain text.
- It never reads, modifies, or has access to any other website, browser tab,
  or Proton service (Mail, Calendar, Drive files other than the open Doc,
  account settings, etc.).
- Your document content never leaves your browser. The extension makes **no
  network requests** of any kind — there is no analytics, telemetry, crash
  reporting, or remote server to send data to.

## What the extension stores

The extension uses the browser's built-in `storage` API, entirely local to
your own browser (and, for settings, synced only through your browser
vendor's own account sync — Proton Docs as Task never sees or receives it):

- **Settings** (`browser.storage.sync`): your display preferences — theme,
  card density, default view, workflow label names, and your own name for the
  "My open tasks" filter.
- **Per-document session preferences** (`browser.storage.local`): UI state
  like sort order, collapsed columns, and filters, keyed to the document you
  were viewing.

None of this data is personal beyond what you choose to type into your own
Proton Docs documents or the "your name" settings field, and none of it is
ever transmitted anywhere — it stays in your browser's local storage.

## Third parties

The extension does not integrate with, or share data with, any third-party
service, advertiser, or analytics provider.

## Changes

If this policy changes, the update will be reflected in this file, versioned
alongside the extension's source in its
[GitHub repository](https://github.com/josselinonduty/proton-docs-as-task).

## Contact

This is an independent, unofficial project, not affiliated with Proton AG.
Questions or concerns: open an issue at
<https://github.com/josselinonduty/proton-docs-as-task/issues>.
