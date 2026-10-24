import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import type { Layout } from '../../lib/onboarding';
import { flowSummary } from '../../lib/statuses';
import type { StatusFlow } from '../../lib/types';

const DOCS_URL = 'https://docs.proton.me/';
const COPIED_MS = 1500;

interface DoneProps {
  layout: Layout;
  flow: StatusFlow;
  /** The marker to put on the first line of a document. */
  marker: string;
  /** Setup was skipped, so the summary shows the settings that were kept. */
  skipped: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

/** Result screen: what was set, and the way into a first board. */
export function Done({ layout, flow, marker, skipped, headingRef }: DoneProps) {
  const { t } = useTranslation();
  const [docsTab, setDocsTab] = useState<{ id: number; windowId?: number } | null>(null);
  const [copied, setCopied] = useState(false);

  // An already open Proton Docs tab is focused rather than duplicated.
  useEffect(() => {
    void browser.tabs
      .query({ url: `${DOCS_URL}*` })
      .then(([tab]) => setDocsTab(tab?.id != null ? { id: tab.id, windowId: tab.windowId } : null))
      .catch(() => setDocsTab(null));
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function openDocs() {
    if (!docsTab) {
      await browser.tabs.create({ url: DOCS_URL });
      return;
    }
    await browser.tabs.update(docsTab.id, { active: true });
    if (docsTab.windowId != null) await browser.windows.update(docsTab.windowId, { focused: true });
  }

  async function copyMarker() {
    try {
      await navigator.clipboard.writeText(marker);
      setCopied(true);
    } catch {
      /* clipboard unavailable: the marker is shown for manual copy */
    }
  }

  return (
    <div>
      <h2 className="wl-title" ref={headingRef} tabIndex={-1}>
        {t('welcome.done.title')}
      </h2>
      <p className="wl-hint">{skipped ? t('welcome.done.skippedHint') : t('welcome.done.hint')}</p>

      <dl className="wl-summary">
        <dt>{t('welcome.done.layout')}</dt>
        <dd>{t(`layouts.${layout}.name`)}</dd>
        <dt>{t('welcome.done.flow')}</dt>
        <dd>
          {t(`statusFlows.${flow}.name`)} <span className="wl-chain">{flowSummary(flow)}</span>
        </dd>
      </dl>

      <div className="wl-next">
        <button type="button" className="pdt-btn pdt-btn-primary" onClick={() => void openDocs()}>
          {docsTab ? t('welcome.done.goToDocs') : t('welcome.done.openDocs')}
        </button>
        <p className="wl-hint">{t('welcome.done.openHint')}</p>
      </div>

      <div className="wl-snippet">
        <h3>{t('welcome.done.snippetTitle')}</h3>
        <p className="wl-hint">{t('welcome.done.snippetHint')}</p>
        <div className="wl-snippet__row">
          <code>{marker}</code>
          <button type="button" className="pdt-btn pdt-btn-sm" onClick={() => void copyMarker()}>
            {t('welcome.done.copy')}
          </button>
          <span className="wl-copied" role="status">
            {copied ? t('welcome.done.copied') : ''}
          </span>
        </div>
      </div>

      <footer className="wl-actions">
        <button
          type="button"
          className="pdt-link"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          {t('welcome.done.settings')}
        </button>
      </footer>
    </div>
  );
}
