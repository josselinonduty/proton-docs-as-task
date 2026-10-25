/** The tab the popup and welcome page see: a Proton Docs document with a board. */
const DOCS_TAB = { id: 1, windowId: 1, url: 'https://docs.proton.me/doc?mode=open' };

/**
 * Playground stand-in for `wxt/browser`: what the board overlay and the
 * extension pages (popup, options, welcome) touch. Extension pages are served
 * next to the playground, so their URLs resolve to `/<page>.html`.
 */
export const browser = {
  runtime: {
    getURL(path: string) {
      return new URL(path, location.origin).href;
    },
    async openOptionsPage() {
      window.open('/options.html', '_blank');
    },
  },
  tabs: {
    async query() {
      return [DOCS_TAB];
    },
    async create() {},
    async update() {},
  },
  windows: {
    async update() {},
  },
};
