import { modLabel } from '../lib/platform';
import { Dialog } from './Dialog';

interface ShortcutHelpProps {
  onClose: () => void;
}

/** Groups of documented board shortcuts, rendered in the help dialog. */
function groups(mod: string): { title: string; items: [string, string][] }[] {
  return [
    {
      title: 'Create & find',
      items: [
        ['N', 'Open quick-add task'],
        ['/', 'Focus search'],
        ['F', 'Open filters'],
        [`${mod} K`, 'Open command palette'],
      ],
    },
    {
      title: 'View',
      items: [
        ['V', 'Change board view'],
        ['S', 'Open sort menu'],
        ['?', 'Open this shortcut reference'],
      ],
    },
    {
      title: 'Navigate & edit cards',
      items: [
        ['J / K', 'Focus next / previous card'],
        ['Enter', 'Open focused card'],
        ['E', 'Edit focused card title'],
        ['Space', 'Select focused card'],
        ['X', 'Toggle completion'],
        ['M', 'Open move menu'],
        ['Delete / Backspace', 'Delete selected card (after confirm)'],
      ],
    },
    {
      title: 'General',
      items: [
        [`${mod} Z`, 'Undo last board action'],
        ['Esc', 'Close the active menu, editor, or dialog'],
      ],
    },
  ];
}

/** Keyboard shortcut reference, reachable via `?` and the command palette. */
export function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const mod = modLabel();
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose}>
      <div className="pdt-shortcuts">
        {groups(mod).map((group) => (
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
      <p className="pdt-shortcuts__note">
        Shortcuts don't fire while typing in a field, except the documented submission shortcuts.
      </p>
    </Dialog>
  );
}
