import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';

export interface Command {
  id: string;
  title: string;
  hint?: string;
  keywords?: string;
  disabled?: boolean;
  /** Shown when the command is disabled, explaining why it can't run. */
  disabledReason?: string;
  run: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

// Recently-run command ids for the current session, most-recent first.
const recent: string[] = [];

function rememberRecent(id: string): void {
  const i = recent.indexOf(id);
  if (i >= 0) recent.splice(i, 1);
  recent.unshift(id);
  if (recent.length > 8) recent.length = 8;
}

function score(command: Command, q: string): number {
  const hay = `${command.title} ${command.keywords ?? ''}`.toLowerCase();
  if (!q) return 0;
  if (command.title.toLowerCase().startsWith(q)) return 3;
  if (command.title.toLowerCase().includes(q)) return 2;
  return hay.includes(q) ? 1 : -1;
}

/**
 * A searchable command palette (Cmd/Ctrl+K). Results support arrow-key
 * navigation; recently used commands surface first when the query is empty.
 * Disabled commands stay listed and explain why they can't run. Every command
 * here is also reachable elsewhere in the UI. It's a modal of its own, so it
 * opens on top of any open dialog.
 */
export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      const byRecent = [...commands].sort((a, b) => {
        const ra = recent.indexOf(a.id);
        const rb = recent.indexOf(b.id);
        if (ra === -1 && rb === -1) return 0;
        if (ra === -1) return 1;
        if (rb === -1) return -1;
        return ra - rb;
      });
      return byRecent;
    }
    return commands
      .map((c) => ({ c, s: score(c, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [commands, query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const runAt = (index: number) => {
    const command = results[index];
    if (!command || command.disabled) return;
    rememberRecent(command.id);
    onClose();
    command.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    }
  };

  return (
    <Modal
      className="pdt-modal pdt-modal--top"
      aria-label={t('palette.title')}
      onClose={onClose}
      initialFocus={inputRef}
    >
      <div className="pdt-palette" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          className="pdt-palette__input"
          role="combobox"
          aria-expanded="true"
          aria-controls="pdt-palette-list"
          aria-activedescendant={results[active] ? `pdt-cmd-${results[active].id}` : undefined}
          aria-autocomplete="list"
          aria-label={t('palette.search')}
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // A new query means a new list: start again from its top.
            setActive(0);
          }}
        />
        <ul className="pdt-palette__list" id="pdt-palette-list" role="listbox" ref={listRef}>
          {results.map((command, i) => (
            <li
              key={command.id}
              id={`pdt-cmd-${command.id}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              aria-disabled={command.disabled}
              className={`pdt-palette__item ${i === active ? 'is-active' : ''} ${
                command.disabled ? 'is-disabled' : ''
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                runAt(i);
              }}
              title={command.disabled ? command.disabledReason : undefined}
            >
              <span className="pdt-palette__item-title">{command.title}</span>
              {command.disabled && command.disabledReason ? (
                <span className="pdt-palette__item-hint">{command.disabledReason}</span>
              ) : (
                command.hint && <span className="pdt-palette__item-hint">{command.hint}</span>
              )}
            </li>
          ))}
          {results.length === 0 && <li className="pdt-palette__empty">{t('palette.empty')}</li>}
        </ul>
      </div>
    </Modal>
  );
}
