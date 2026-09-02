# Security Policy

## Scope

Proton Docs as Task is a browser extension that runs entirely on the client. It:

- requests only the `storage` permission and host access to `docs.proton.me`
  and `docs-editor.proton.me`;
- makes **no network requests** and transmits nothing off the device;
- reads the open document's editor DOM and renders a board in an isolated
  Shadow DOM overlay. It never writes back into the document.

This is an independent, unofficial project and is **not** affiliated with
Proton AG. Vulnerabilities in Proton Docs itself should be reported to Proton,
not here.

## Supported versions

Only the latest released version receives security fixes.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** — do not open a public
issue for anything exploitable.

- Preferred: open a
  [GitHub private security advisory](https://github.com/josselinonduty/proton-docs-as-task/security/advisories/new).
- Include reproduction steps, affected version(s), browser, and impact.

You can expect an acknowledgement within a few days. Once a fix is available,
a patched release will be published and the reporter credited (unless anonymity
is requested).
