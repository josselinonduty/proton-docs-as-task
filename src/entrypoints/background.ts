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
});
