/** Playground stand-in for `wxt/browser`: only what the board overlay touches. */
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
  },
};
