import { StrictMode, type ComponentType } from 'react';
import ReactDOM from 'react-dom/client';
import i18n from '../i18n';
import { syncLanguage } from '../lib/settings';

/**
 * Render an extension page (popup, options). It must render synchronously:
 * Chrome sizes the embedded options dialog from the page at load, and never
 * shows it if the page is still empty then.
 */
export function mountPage(App: ComponentType) {
  i18n.on('languageChanged', (language) => {
    document.documentElement.lang = language;
  });
  void syncLanguage();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
