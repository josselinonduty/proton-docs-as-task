# Contributing

Thanks for your interest in improving **Proton Docs as Task**! This is a small,
focused project — issues and pull requests are welcome.

## Prerequisites

- **Node 22+** (Node 24 is used in CI).
- npm (the repository ships an `npm` lockfile).

## Getting started

```bash
npm install          # install deps (runs `wxt prepare`)
npm run dev          # launch Chrome with the extension + HMR
npm run dev:firefox  # launch Firefox instead
```

Then open a document on `docs.proton.me`, make its first line `#!tasks`, and add
a few `- [ ]` items.

## Before you push

CI runs each of these on every push and pull request — run them locally first so
you get a green build:

```bash
npm run lint          # ESLint
npm run format:check  # Prettier (use `npm run format` to fix)
npm run compile       # tsc --noEmit
npm test              # Vitest
npm run build         # Chrome production build
npm run build:firefox # Firefox production build
```

## Guidelines

- **Keep the core logic pure and tested.** Parsing, grouping, merging and the
  editor-state mapping live in `src/lib` with unit tests (`*.test.ts`). Add or
  update tests alongside behavior changes — the editor bridge especially
  (`editorDoc.ts`, `editorBridge.ts`), since it tracks Proton's Lexical setup;
  its tests run against the same Lexical version Proton ships.
- **The document is the single source of truth.** Every write goes through
  Proton's editor via the bridge — never by faking input events — and is
  merged with concurrent changes rather than overwriting them.
- **Least privilege.** Don't add manifest permissions or host origins unless a
  feature genuinely needs them, and explain why in the PR.
- **Formatting is enforced by Prettier**, so don't hand-format — just run
  `npm run format`.

## Commit & PR

- Use clear, descriptive commit messages.
- Describe the user-facing effect of the change in the PR, and note anything a
  reviewer should manually verify in the browser.
- Update `CHANGELOG.md` under an `Unreleased` heading for user-visible changes.

## Releasing

Releasing is documented in the [README](README.md#releasing): bump the version
in `package.json`, tag `vX.Y.Z`, and push the tag — the release workflow builds
the Chrome and Firefox packages, attaches them to a GitHub Release, and (once
the [store credentials](README.md#store-credentials) are configured as repo
secrets) submits them to the Chrome Web Store and Firefox Add-ons for review.
