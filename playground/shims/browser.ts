import type { AddTaskResponse, ContentMessage, StatusResponse } from '../../src/lib/messaging';

/** The tab the popup and welcome page see: a Proton Docs document with a board. */
const DOCS_TAB = { id: 1, windowId: 1, url: 'https://docs.proton.me/doc?mode=open' };

/** What the content script would report for the playground's sample board. */
const STATUS: StatusResponse = {
  ok: true,
  activated: true,
  visible: true,
  taskCount: 14,
  doneCount: 3,
  boardTitle: 'Product launch',
  sections: ['Discovery', 'Build', 'Launch', 'Later / icebox'],
};

/**
 * Playground stand-in for `wxt/browser`: what the board overlay and the
 * extension pages (popup, options, welcome) touch. Extension pages are served
 * next to the playground, so their URLs resolve to `/<page>.html`.
 */
export const browser = {
  runtime: {
    async sendMessage(message: { type?: string }) {
      if (message?.type === 'open-options') {
        window.dispatchEvent(new CustomEvent('pdt-playground:open-options'));
      }
    },
    onMessage: {
      addListener() {},
      removeListener() {},
    },
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
    async sendMessage(
      _tabId: number,
      message: ContentMessage,
    ): Promise<StatusResponse | AddTaskResponse> {
      if (message.type === 'add-task') {
        return { ok: true, added: true, section: message.section || STATUS.sections![0] };
      }
      return STATUS;
    },
    async create() {},
    async update() {},
  },
  windows: {
    async update() {},
  },
};
