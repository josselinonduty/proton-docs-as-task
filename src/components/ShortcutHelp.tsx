import { useTranslation } from 'react-i18next';
import { modLabel } from '../lib/platform';
import { Dialog } from './Dialog';
import { shortcutHelp } from './board/shortcuts';

interface ShortcutHelpProps {
  onClose: () => void;
}

/**
 * Keyboard shortcut reference, reachable via `?` and the command palette. Its
 * rows come from the board's key map, so they can't drift from what the keys do.
 */
export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const { t } = useTranslation();
  const mod = modLabel();
  return (
    <Dialog title={t('shortcuts.title')} onClose={onClose}>
      <div className="pdt-shortcuts">
        {shortcutHelp(mod).map(({ group, items }) => (
          <section key={group} className="pdt-shortcuts__group">
            <h3 className="pdt-shortcuts__title">{t(`shortcuts.${group}.title`)}</h3>
            <dl className="pdt-shortcuts__list">
              {items.map(({ keys, text }) => (
                <div key={keys} className="pdt-shortcuts__row">
                  <dt>
                    {keys.split(' ').map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{t(text)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="pdt-shortcuts__note">{t('shortcuts.note')}</p>
    </Dialog>
  );
}
