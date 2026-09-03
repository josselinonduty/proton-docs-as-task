import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  // Open the options page the first time the extension is installed so users
  // discover the activation marker and syntax.
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      browser.runtime.openOptionsPage().catch(() => {
        /* options page may be unavailable in some contexts */
      });
    }
  });

  // `browser.runtime.openOptionsPage` is not available in content scripts, so
  // the in-page board asks the background to open the options page for it.
  browser.runtime.onMessage.addListener((message: unknown) => {
    if ((message as { type?: string })?.type === 'open-options') {
      return browser.runtime
        .openOptionsPage()
        .then(() => ({ ok: true }))
        .catch(() => ({ ok: false }));
    }
    return undefined;
  });
});
