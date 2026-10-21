import { useState } from 'react';
import type { BoardTask, LinkKind, TaskLinks } from '../lib/model';
import { Icon } from './Icon';

interface TaskRelationsProps {
  links: TaskLinks;
  /** Whether a linked task is completed (in a Done status). */
  isDone: (task: BoardTask) => boolean;
  /** Tasks that may be linked to the open one, per relationship. */
  candidates: (kind: LinkKind) => BoardTask[];
  onOpen: (id: string) => void;
  onLink: (kind: LinkKind, id: string) => void;
  onUnlink: (id: string) => void;
}

const GROUPS: { kind: LinkKind; label: string }[] = [
  { kind: 'blockedBy', label: 'Blocked by' },
  { kind: 'blocks', label: 'Blocks' },
  { kind: 'related', label: 'Related to' },
];

/** GitLab-style linked tasks: grouped by relationship, one click to open or unlink. */
export function TaskRelations({
  links,
  isDone,
  candidates,
  onOpen,
  onLink,
  onUnlink,
}: TaskRelationsProps) {
  const [kind, setKind] = useState<LinkKind>('blockedBy');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? candidates(kind)
        .filter((t) => t.title.toLowerCase().includes(needle))
        .slice(0, 6)
    : [];

  return (
    <div className="pdt-field">
      <span className="pdt-field-label">Linked tasks</span>
      {GROUPS.map(({ kind: groupKind, label }) =>
        links[groupKind].length ? (
          <div key={groupKind} className="pdt-rel__group">
            <span className="pdt-rel__label">{label}</span>
            <ul className="pdt-rel__list">
              {links[groupKind].map((t) => (
                <li key={t.id} className="pdt-rel__item">
                  <button
                    type="button"
                    className="pdt-rel__open"
                    title="Open task"
                    onClick={() => onOpen(t.id)}
                  >
                    <Icon name={isDone(t) ? 'checkmark-circle' : 'link'} size={14} />
                    <span className={isDone(t) ? 'pdt-card__title--done' : ''}>
                      {t.title || 'Untitled task'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pdt-btn pdt-btn-icon pdt-btn-sm"
                    aria-label={`Unlink ${t.title || 'task'}`}
                    title="Unlink"
                    onClick={() => onUnlink(t.id)}
                  >
                    <Icon name="cross" size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      <div className="pdt-details__row">
        <select
          className="pdt-select pdt-rel__kind"
          aria-label="Relationship"
          value={kind}
          onChange={(e) => setKind(e.target.value as LinkKind)}
        >
          {GROUPS.map((g) => (
            <option key={g.kind} value={g.kind}>
              {g.label}
            </option>
          ))}
        </select>
        <input
          className="pdt-input pdt-rel__search"
          type="search"
          value={query}
          placeholder="Search tasks to link…"
          aria-label="Search tasks to link"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {needle && (
        <ul className="pdt-rel__list" aria-label="Matching tasks">
          {matches.length ? (
            matches.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="pdt-rel__open"
                  onClick={() => {
                    onLink(kind, t.id);
                    setQuery('');
                  }}
                >
                  <Icon name="plus" size={14} />
                  <span>{t.title || 'Untitled task'}</span>
                  <span className="pdt-text-weak">{t.section}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="pdt-text-weak pdt-details__hint">No linkable task found</li>
          )}
        </ul>
      )}
    </div>
  );
}
