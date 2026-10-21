import { useRef, useState } from 'react';
import {
  addStatus,
  canChangeStatusCategory,
  canRemoveStatus,
  moveStatus,
  updateStatus,
  type BoardModel,
} from '../lib/model';
import { hasLowContrast, STATUS_CATEGORIES } from '../lib/statuses';
import type { StatusCategory, StatusDef, StatusKey } from '../lib/types';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { SectionNameInput } from './SectionNameInput';
import { StatusColorPicker, statusStyle } from './StatusColorPicker';

interface BoardSettingsDialogProps {
  model: BoardModel;
  announce: (message: string) => void;
  onChange: (next: BoardModel, undoLabel?: string) => void;
  /** Ask to delete a status (the board confirms when it still has tasks). */
  onRequestDelete: (key: StatusKey) => void;
  onClose: () => void;
}

/**
 * Per-document board settings. Everything here is stored in the document
 * itself (`@settings` lines), so it syncs and shares with the board. Each
 * change is written right away as one undoable edit.
 */
export function BoardSettingsDialog({
  model,
  announce,
  onChange,
  onRequestDelete,
  onClose,
}: BoardSettingsDialogProps) {
  const [focusKey, setFocusKey] = useState<StatusKey | null>(null);
  const [dragKey, setDragKey] = useState<StatusKey | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { statuses } = model;

  const move = (status: StatusDef, delta: number) => {
    const next = moveStatus(model, status.key, delta);
    if (next === model) return;
    onChange(next, `Moved status “${status.label}”`);
    announce(`${status.label} moved ${delta < 0 ? 'up' : 'down'}`);
  };

  const dropOn = (target: StatusDef) => {
    const from = statuses.findIndex((s) => s.key === dragKey);
    const to = statuses.findIndex((s) => s.key === target.key);
    setDragKey(null);
    if (from < 0 || to < 0 || from === to) return;
    move(statuses[from]!, to - from);
  };

  const add = () => {
    const { model: next, key } = addStatus(model);
    onChange(next, 'Added status');
    setFocusKey(key);
    announce('Status added');
  };

  return (
    <Dialog title="Board settings" size="lg" onClose={onClose} initialFocus={headingRef}>
      <section className="pdt-settings" aria-labelledby="pdt-settings-statuses">
        <h3
          className="pdt-settings__heading"
          id="pdt-settings-statuses"
          ref={headingRef}
          tabIndex={-1}
        >
          Statuses
        </h3>
        <p className="pdt-modal__text">
          The board’s workflow columns, saved in this document. A ticked checkbox means the first{' '}
          <em>Done</em> status; new tasks start in the first <em>Not started</em> one. Reorder with
          drag and drop or <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd>.
        </p>

        <ul className="pdt-statuslist">
          {statuses.map((status, i) => {
            const count = model.tasks.filter((t) => t.status === status.key).length;
            const removable = canRemoveStatus(model, status.key);
            return (
              <li
                key={status.key}
                className={`pdt-statuslist__row ${dragKey === status.key ? 'is-dragging' : ''}`}
                style={statusStyle(status)}
                onDragOver={(e) => dragKey && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(status);
                }}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                  // Alt+↓ opens a focused <select>; leave it alone.
                  if ((e.target as HTMLElement).tagName === 'SELECT') return;
                  e.preventDefault();
                  move(status, e.key === 'ArrowUp' ? -1 : 1);
                }}
              >
                <span
                  className="pdt-statuslist__handle"
                  draggable
                  aria-hidden="true"
                  title="Drag to reorder"
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDragKey(status.key);
                  }}
                  onDragEnd={() => setDragKey(null)}
                >
                  <Icon name="dots-vertical" size={14} />
                </span>

                <div className="pdt-statuslist__main">
                  <div className="pdt-statuslist__name">
                    <span className="pdt-status-name">
                      <SectionNameInput
                        name={status.label}
                        noun="status"
                        ignoreCase
                        otherNames={statuses.filter((s) => s !== status).map((s) => s.label)}
                        autoFocus={focusKey === status.key}
                        onFocusHandled={() => setFocusKey(null)}
                        onRename={(label) => {
                          onChange(
                            updateStatus(model, status.key, { label }),
                            `Renamed status to “${label}”`,
                          );
                          announce(`Status renamed to ${label}`);
                        }}
                        onInvalid={announce}
                      />
                    </span>
                    <code className="pdt-statuslist__key" title="Key written on task lines">
                      @status:{status.key}
                    </code>
                  </div>

                  <div className="pdt-statuslist__props">
                    <label className="pdt-statuslist__category">
                      <span className="pdt-sr-only">Category of {status.label}</span>
                      <select
                        className="pdt-select"
                        value={status.category}
                        title="Category"
                        onChange={(e) => {
                          const category = e.target.value as StatusCategory;
                          onChange(
                            updateStatus(model, status.key, { category }),
                            `Changed category of “${status.label}”`,
                          );
                        }}
                      >
                        {STATUS_CATEGORIES.map((c) => (
                          <option
                            key={c.key}
                            value={c.key}
                            disabled={!canChangeStatusCategory(model, status.key, c.key)}
                          >
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <StatusColorPicker
                      label="Text"
                      role="text"
                      value={status.color}
                      pairedValue={status.bg}
                      onChange={(color) =>
                        onChange(
                          updateStatus(model, status.key, { color }),
                          `Changed colour of “${status.label}”`,
                        )
                      }
                    />
                    <StatusColorPicker
                      label="Background"
                      role="bg"
                      value={status.bg}
                      pairedValue={status.color}
                      onChange={(bg) =>
                        onChange(
                          updateStatus(model, status.key, { bg }),
                          `Changed background of “${status.label}”`,
                        )
                      }
                    />
                    <span className="pdt-statuslist__count">
                      {count} {count === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                  {hasLowContrast(status) && (
                    <p className="pdt-statuslist__warning" role="status">
                      <Icon name="exclamation-circle" size={14} /> These colours may be hard to
                      read. Aim for more contrast between text and background.
                    </p>
                  )}
                </div>

                <div className="pdt-statuslist__ops">
                  <button
                    type="button"
                    className="pdt-btn pdt-btn-icon pdt-btn-sm"
                    aria-label={`Move ${status.label} up`}
                    title="Move up (Alt+↑)"
                    disabled={i === 0}
                    onClick={() => move(status, -1)}
                  >
                    <Icon name="arrow-up" />
                  </button>
                  <button
                    type="button"
                    className="pdt-btn pdt-btn-icon pdt-btn-sm"
                    aria-label={`Move ${status.label} down`}
                    title="Move down (Alt+↓)"
                    disabled={i === statuses.length - 1}
                    onClick={() => move(status, 1)}
                  >
                    <Icon name="arrow-down" />
                  </button>
                  <button
                    type="button"
                    className="pdt-btn pdt-btn-icon pdt-btn-sm"
                    aria-label={`Delete status ${status.label}`}
                    title={
                      removable
                        ? 'Delete status'
                        : `A board needs at least one ${status.category === 'done' ? 'Done' : 'Not started'} status`
                    }
                    disabled={!removable}
                    onClick={() => onRequestDelete(status.key)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <button type="button" className="pdt-btn pdt-btn-sm" onClick={add}>
          <Icon name="plus" size={14} />
          Add status
        </button>
      </section>

      <div className="pdt-modal__actions">
        <button type="button" className="pdt-btn pdt-btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
