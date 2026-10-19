import { defineContentScript } from '#imports';
import iconHref from '../../assets/icon.svg?inline';
import { applyBranding, EDITOR_ORIGIN, isBrandingMessage } from '../lib/branding';

/**
 * Runs in the top Docs shell only. The editor iframe reports whether the
 * document is a task board; while it is, the tab favicon and the document
 * icon in the header show the app icon.
 */
export default defineContentScript({
  matches: ['https://docs.proton.me/*'],
  allFrames: false,
  main(ctx) {
    let active = false;

    const render = () => applyBranding(document, active ? iconHref : null);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== EDITOR_ORIGIN || !isBrandingMessage(event.data)) return;
      active = event.data.active;
      render();
    };
    window.addEventListener('message', onMessage);

    // Proton re-renders its header and favicon as the app navigates.
    const observer = new MutationObserver(() => {
      if (active) render();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    ctx.onInvalidated(() => {
      window.removeEventListener('message', onMessage);
      observer.disconnect();
      applyBranding(document, null);
    });
  },
});
