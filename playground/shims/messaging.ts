import type {
  AddTaskResponse,
  ProtocolMap,
  QuickAddTask,
  StatusResponse,
} from '../../src/lib/messaging';

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

function respond(
  type: keyof ProtocolMap,
  data: unknown,
): StatusResponse | AddTaskResponse | boolean {
  switch (type) {
    case 'open-options':
      window.dispatchEvent(new CustomEvent('pdt-playground:open-options'));
      return true;
    case 'add-task': {
      const { section } = data as QuickAddTask;
      return { ok: true, added: true, section: section || STATUS.sections![0] };
    }
    default:
      return STATUS;
  }
}

/**
 * Playground stand-in for `@webext-core/messaging`: there is no background or
 * content script, so the popup gets the sample board's status and the board's
 * "open settings" opens the playground's options page.
 */
export function defineExtensionMessaging() {
  return {
    async sendMessage(type: keyof ProtocolMap, data?: unknown) {
      return respond(type, data);
    },
    onMessage() {
      return () => {};
    },
    removeAllListeners() {},
  };
}
