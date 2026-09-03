import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Proton Docs as Task',
    description:
      'Turn a Proton Docs document into an interactive task board — start it with the activation marker and its checklist becomes Kanban.',
    permissions: ['storage'],
    // The document content lives inside the sandboxed Lexical editor iframe
    // (docs-editor.proton.me) embedded in the Docs shell (docs.proton.me).
    host_permissions: ['https://docs.proton.me/*', 'https://docs-editor.proton.me/*'],
    action: {
      default_title: 'Proton Docs as Task',
    },
    browser_specific_settings: {
      gecko: {
        id: 'proton-docs-as-task@josselinonduty.fr',
        // The extension makes no network requests and collects nothing —
        // see PRIVACY.md. Required by Firefox for all new extensions:
        // https://mzl.la/firefox-builtin-data-consent
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  },
});
