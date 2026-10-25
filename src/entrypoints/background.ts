import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';
import { onMessage } from '@/lib/messaging';

export default defineBackground(() => {
  // Greet new installs with the welcome page, which sets up their layout and
  // status flow. Updates stay quiet: it is reachable from the options page.
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') }).catch(() => {
        /* tabs may be unavailable in some contexts */
      });
    }
  });

  // `browser.runtime.openOptionsPage` is not available in content scripts, so
  // the in-page board asks the background to open the options page for it.
  onMessage('open-options', () =>
    browser.runtime.openOptionsPage().then(
      () => true,
      () => false,
    ),
  );
});
