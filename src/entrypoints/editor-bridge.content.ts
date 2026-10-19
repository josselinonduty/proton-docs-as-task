import { defineContentScript } from '#imports';
import { startEditorBridge } from '../lib/editorBridge';

/**
 * Runs in the page's own JavaScript world, next to Proton's code, so it can
 * reach the Lexical editor instance (see `lib/editorBridge.ts`). It has no
 * extension APIs; it only talks to the `proton-task` content script through
 * DOM events.
 */
export default defineContentScript({
  matches: ['https://docs.proton.me/*', 'https://docs-editor.proton.me/*'],
  allFrames: true,
  world: 'MAIN',
  main() {
    startEditorBridge(document);
  },
});
