# Releasing

Releases are automated with [release-please][release-please]. Commits on
`main` follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix                                         | Effect                           |
| ---------------------------------------------- | -------------------------------- |
| `fix:`                                         | patch bump (`1.1.0` → `1.1.1`)   |
| `feat:`                                        | minor bump (`1.1.0` → `1.2.0`)   |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` footer | major bump (`1.1.0` → `2.0.0`)   |
| `perf:`, `refactor:`, `docs:`                  | listed in the changelog          |
| `chore:`, `ci:`, `build:`, `test:`, `style:`   | no release, not in the changelog |

The [`release-please` workflow](../.github/workflows/release-please.yml) keeps
a standing **"chore(main): release X.Y.Z"** pull request open against `main`. It
gathers everything merged since the last release, bumps the version in
`package.json` / `package-lock.json` (WXT uses it for the manifest) and adds the
new section to `CHANGELOG.md`. Nothing is released until that PR is merged;
merging it creates the `vX.Y.Z` tag and GitHub Release, then calls the
[`release` workflow](../.github/workflows/release.yml). Squash-merge PRs (or
give merges conventional titles) so the PR title is the commit that is parsed.

The `release` workflow type-checks, tests, builds the Chrome and Firefox
packages, and attaches them (plus a Firefox sources archive) to the GitHub
Release. It can be re-run by hand from the Actions tab with an existing tag,
such as `v1.1.0`.

One-time repository setup: enable **Settings → Actions → General → Allow GitHub
Actions to create and approve pull requests**. PRs opened by the default
`GITHUB_TOKEN` don't trigger CI; to get checks on the release PR, add a
`RELEASE_PLEASE_TOKEN` secret (a PAT or GitHub App token with contents and
pull-requests write).

## Store submission

When the store credentials below are set as repository secrets, the workflow
also submits the packages to the Chrome Web Store and Firefox Add-ons (AMO) for
review, using [`wxt submit`][wxt-submit] (backed by
[`publish-browser-extension`][pbe]). A store whose secrets aren't set is
skipped without failing the release, so the GitHub Release always publishes.

Store listings use the images in `assets/screenshots/` (five 1280×800 frames, the
Chrome Web Store maximum). Regenerate them as described in
[CONTRIBUTING](../CONTRIBUTING.md#playground-and-screenshots) before a release
that changes the UI.

### Store credentials

| Secret                                | Store   | Where to get it                                                                                                              |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `CHROME_EXTENSION_ID`                 | Chrome  | The extension's ID on the [Chrome Web Store Developer Dashboard][chrome-dashboard] (create the listing once, by hand, first) |
| `CHROME_PUBLISHER_ID`                 | Chrome  | From the dashboard URL after selecting your publisher account                                                                |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | Chrome  | `client_email` from a [Google Cloud service account][gcp-service-accounts] JSON key                                          |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`  | Chrome  | `private_key` from the same JSON key                                                                                         |
| `FIREFOX_EXTENSION_ID`                | Firefox | The add-on's ID/slug on [addons.mozilla.org][amo-devhub] (create the listing once, by hand, first)                           |
| `FIREFOX_JWT_ISSUER`                  | Firefox | `JWT issuer` from your [AMO API keys][amo-api-keys]                                                                          |
| `FIREFOX_JWT_SECRET`                  | Firefox | `JWT secret` from the same page                                                                                              |

Chrome submission uses Web Store API **v2** (service account auth); the
workflow sets `CHROME_API_VERSION=v2` itself, so it isn't a secret. The older
v1.1 OAuth flow (client ID, secret and refresh token) is deprecated and stops
working on October 15th, 2026.

Run `npm run submit:init` locally to generate these values interactively (it
writes them to a git-ignored `.env.submit` file), then copy them into the
repository's **Settings → Secrets and variables → Actions**. Create the store
listings once, by hand: `wxt submit` uploads new versions to an existing
listing but doesn't create one.

[release-please]: https://github.com/googleapis/release-please
[wxt-submit]: https://wxt.dev/guide/essentials/publishing.html
[pbe]: https://github.com/aklinker1/publish-browser-extension
[chrome-dashboard]: https://chrome.google.com/webstore/devconsole
[gcp-service-accounts]: https://developer.chrome.com/docs/webstore/service-accounts
[amo-devhub]: https://addons.mozilla.org/developers/
[amo-api-keys]: https://addons.mozilla.org/developers/addon/api/key/
