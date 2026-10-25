import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardTask, LinkKind, TaskLinks } from '@/lib/model';
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

const GROUPS: LinkKind[] = ['blockedBy', 'blocks', 'related'];

/** GitLab-style linked tasks: grouped by relationship, one click to open or unlink. */
export function TaskRelations({
  links,
  isDone,
  candidates,
  onOpen,
  onLink,
  onUnlink,
}: TaskRelationsProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<LinkKind>('blockedBy');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? candidates(kind)
        .filter((task) => task.title.toLowerCase().includes(needle))
        .slice(0, 6)
    : [];

  return (
    <div className="pdt-field">
      <span className="pdt-field-label">{t('relations.title')}</span>
      {GROUPS.map((groupKind) =>
        links[groupKind].length ? (
          <div key={groupKind} className="pdt-rel__group">
            <span className="pdt-rel__label">{t(`relations.${groupKind}`)}</span>
            <ul className="pdt-rel__list">
              {links[groupKind].map((task) => (
                <li key={task.id} className="pdt-rel__item">
                  <button
                    type="button"
                    className="pdt-rel__open"
                    title={t('relations.open')}
                    onClick={() => onOpen(task.id)}
                  >
                    <Icon name={isDone(task) ? 'checkmark-circle' : 'link'} size={14} />
                    <span className={isDone(task) ? 'pdt-card__title--done' : ''}>
                      {task.title || t('card.untitled')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pdt-btn pdt-btn-icon pdt-btn-sm"
                    aria-label={t('relations.unlink', { title: task.title || t('relations.task') })}
                    title={t('relations.unlinkShort')}
                    onClick={() => onUnlink(task.id)}
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
          aria-label={t('relations.kind')}
          value={kind}
          onChange={(e) => setKind(e.target.value as LinkKind)}
        >
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {t(`relations.${g}`)}
            </option>
          ))}
        </select>
        <input
          className="pdt-input pdt-rel__search"
          type="search"
          value={query}
          placeholder={t('relations.searchPlaceholder')}
          aria-label={t('relations.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {needle && (
        <ul className="pdt-rel__list" aria-label={t('relations.matching')}>
          {matches.length ? (
            matches.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="pdt-rel__open"
                  onClick={() => {
                    onLink(kind, task.id);
                    setQuery('');
                  }}
                >
                  <Icon name="plus" size={14} />
                  <span>{task.title || t('card.untitled')}</span>
                  <span className="pdt-text-weak">{task.section}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="pdt-text-weak pdt-details__hint">{t('relations.none')}</li>
          )}
        </ul>
      )}
    </div>
  );
}
