import { createShadowRootUi, defineContentScript } from '#imports';
import ReactDOM from 'react-dom/client';
import { OverlayApp } from '../../components/OverlayApp';
import { connectEditor } from '../../lib/editorClient';
import { getSettings } from '../../lib/settings';
import './style.css';

export default defineContentScript({
  matches: ['https://docs.proton.me/*', 'https://docs-editor.proton.me/*'],
  allFrames: true,
  cssInjectionMode: 'ui',
  async main(ctx) {
    // Wait for the editor bridge to report Proton's editor. Frames that never
    // host an editor (e.g. the outer Docs shell) simply never get past this.
    const client = connectEditor(document);
    ctx.onInvalidated(() => client.stop());
    const initialState = await client.ready;
    if (!ctx.isValid) return;

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
        reactRoot.render(
          <OverlayApp
            client={client}
            initialState={initialState}
            host={host}
            initialSettings={settings}
          />,
        );
        return reactRoot;
      },
      onRemove(reactRoot) {
        reactRoot?.unmount();
      },
    });

    ui.mount();
  },
});
