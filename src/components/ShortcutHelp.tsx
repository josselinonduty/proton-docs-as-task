import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { modLabel } from '../lib/platform';
import { Dialog } from './Dialog';

interface ShortcutHelpProps {
  onClose: () => void;
}

/** Groups of documented board shortcuts, rendered in the help dialog. */
function groups(mod: string, t: TFunction): { title: string; items: [string, string][] }[] {
  return [
    {
      title: t('shortcuts.createFind.title'),
      items: [
        ['N', t('shortcuts.createFind.newTask')],
        ['/', t('shortcuts.createFind.search')],
        ['F', t('shortcuts.createFind.filters')],
        [`${mod} K`, t('shortcuts.createFind.palette')],
      ],
    },
    {
      title: t('shortcuts.view.title'),
      items: [
        ['V', t('shortcuts.view.changeView')],
        ['S', t('shortcuts.view.sort')],
        ['?', t('shortcuts.view.help')],
      ],
    },
    {
      title: t('shortcuts.cards.title'),
      items: [
        ['J / K', t('shortcuts.cards.focus')],
        ['Enter', t('shortcuts.cards.open')],
        ['E', t('shortcuts.cards.edit')],
        ['Space', t('shortcuts.cards.select')],
        ['X', t('shortcuts.cards.toggle')],
        ['M', t('shortcuts.cards.move')],
        ['Delete / Backspace', t('shortcuts.cards.delete')],
      ],
    },
    {
      title: t('shortcuts.general.title'),
      items: [
        [`${mod} Z`, t('shortcuts.general.undo')],
        ['Esc', t('shortcuts.general.close')],
      ],
    },
  ];
}

/** Keyboard shortcut reference, reachable via `?` and the command palette. */
export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const { t } = useTranslation();
  const mod = modLabel();
  return (
    <Dialog title={t('shortcuts.title')} onClose={onClose}>
      <div className="pdt-shortcuts">
        {groups(mod, t).map((group) => (
          <section key={group.title} className="pdt-shortcuts__group">
            <h3 className="pdt-shortcuts__title">{group.title}</h3>
            <dl className="pdt-shortcuts__list">
              {group.items.map(([keys, desc]) => (
                <div key={keys} className="pdt-shortcuts__row">
                  <dt>
                    {keys.split(' ').map((k) => (
                      <kbd key={k}>{k}</kbd>
                    ))}
                  </dt>
                  <dd>{desc}</dd>
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
