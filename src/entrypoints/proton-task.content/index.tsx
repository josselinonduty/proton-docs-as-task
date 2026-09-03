import { createShadowRootUi, defineContentScript } from '#imports';
import ReactDOM from 'react-dom/client';
import { OverlayApp } from '../../components/OverlayApp';
import { findEditorRoot } from '../../lib/extractor';
import { getSettings } from '../../lib/settings';
import './style.css';

/**
 * Wait for the Lexical editor root to appear in this frame. Returns null in
 * frames that never host an editor (e.g. the outer Docs shell frame).
 */
function waitForEditor(ctx: { isValid: boolean }, timeoutMs = 30_000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing = findEditorRoot();
    if (existing) return resolve(existing);

    const started = Date.now();
    const interval = setInterval(() => {
      if (!ctx.isValid || Date.now() - started > timeoutMs) {
        clearInterval(interval);
        resolve(findEditorRoot());
        return;
      }
      const root = findEditorRoot();
      if (root) {
        clearInterval(interval);
        resolve(root);
      }
    }, 500);
  });
}

export default defineContentScript({
  matches: ['https://docs.proton.me/*', 'https://docs-editor.proton.me/*'],
  allFrames: true,
  cssInjectionMode: 'ui',
  async main(ctx) {
    const root = await waitForEditor(ctx);
    if (!root || !ctx.isValid) return;

    const settings = await getSettings();

    const ui = await createShadowRootUi(ctx, {
      name: 'proton-docs-as-task',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount(container) {
        const host = document.createElement('div');
        host.className = 'pdt-host';
        container.append(host);
        const reactRoot = ReactDOM.createRoot(host);
        reactRoot.render(<OverlayApp root={root} host={host} initialSettings={settings} />);
        return reactRoot;
      },
      onRemove(reactRoot) {
        reactRoot?.unmount();
      },
    });

    ui.mount();
  },
});
