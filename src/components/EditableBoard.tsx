import { useEffect, useRef, useState } from 'react';
import {
  addSection,
  addTask,
  columnsForView,
  countTasks,
  duplicateTask,
  moveSection,
  removeSection,
  removeSectionMovingTasks,
  removeTask,
  renameSection,
  reorderColumn,
  serializeModel,
  serializeTaskLine,
  setTaskSection,
  setTaskStatus,
  setTitle,
  updateTask,
  type BoardColumn,
  type BoardModel,
  type BoardTask,
} from '../lib/model';
import {
  collectFacets,
  hasActiveFilters,
  matchesFilters,
  EMPTY_FILTERS,
  type FilterState,
} from '../lib/filters';
import type { BoardView, SaveState, Settings, StatusKey } from '../lib/types';
import { EditableTaskCard } from './EditableTaskCard';
import { FilterPanel } from './FilterPanel';
import { Dialog } from './Dialog';

interface EditableBoardProps {
  model: BoardModel;
  view: BoardView;
  filters: FilterState;
  settings: Settings;
  marker: string;
  saveState: SaveState;
  undoLabel: string | null;
  announce: (msg: string) => void;
  onChange: (next: BoardModel, undoLabel?: string) => void;
  onViewChange: (v: BoardView) => void;
  onFiltersChange: (f: FilterState) => void;
  onUndo: () => void;
  onRetry: () => void;
  onReloadFromDoc: () => void;
  onOverwriteDoc: () => void;
  onDismissConflict: () => void;
  onClose: () => void;
}

type PendingSectionDelete = { name: string; count: number };

export function EditableBoard(props: EditableBoardProps) {
  const {
    model,
    view,
    filters,
    settings,
    marker,
    saveState,
    undoLabel,
    announce,
    onChange,
    onViewChange,
    onFiltersChange,
    onUndo,
    onRetry,
    onReloadFromDoc,
    onOverwriteDoc,
    onDismissConflict,
    onClose,
  } = props;

  const statusColumns = settings.columns;
  const now = new Date();
  const columns = columnsForView(model, view, statusColumns);
  const facets = collectFacets(model);
  const { total, done } = countTasks(model);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const filtersActive = hasActiveFilters(filters);

  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // column key with an open quick-add
  const [doneCollapsed, setDoneCollapsed] = useState(settings.collapseDoneByDefault);
  const [pendingSectionDelete, setPendingSectionDelete] = useState<PendingSectionDelete | null>(
    null,
  );
  const [pendingCardDelete, setPendingCardDelete] = useState<BoardTask | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const draggedId = useRef<string | null>(null);

  // ---- Card mutations -----------------------------------------------------
  const patchTask = (id: string, patch: Partial<Omit<BoardTask, 'id' | 'order'>>) =>
    onChange(updateTask(model, id, patch));

  const toggleDone = (task: BoardTask) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    onChange(
      setTaskStatus(model, task.id, next),
      task.status === 'done' ? 'Reopened task' : 'Completed task',
    );
    announce(`${task.title || 'Task'} ${next === 'done' ? 'completed' : 'reopened'}`);
  };

  const setStatus = (task: BoardTask, status: StatusKey) => {
    if (status === task.status) return;
    const label = statusColumns.find((c) => c.key === status)?.label ?? status;
    onChange(setTaskStatus(model, task.id, status), `Moved to ${label}`);
    announce(`${task.title || 'Task'} moved to ${label}`);
    setFocusTaskId(task.id);
  };

  const setSection = (task: BoardTask, section: string) => {
    if (section === task.section) return;
    onChange(setTaskSection(model, task.id, section), `Moved to ${section}`);
    announce(`${task.title || 'Task'} moved to ${section}`);
    setFocusTaskId(task.id);
  };

  const moveWithin = (col: BoardColumn, task: BoardTask, delta: number) => {
    const ids = col.tasks.map((t) => t.id);
    const i = ids.indexOf(task.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(reorderColumn(model, next));
    announce(`${task.title || 'Task'} moved ${delta < 0 ? 'up' : 'down'} in ${col.label}`);
    setFocusTaskId(task.id);
  };

  const requestDelete = (task: BoardTask) => {
    if (settings.confirmDelete) setPendingCardDelete(task);
    else confirmDeleteCard(task);
  };

  const confirmDeleteCard = (task: BoardTask) => {
    onChange(removeTask(model, task.id), 'Deleted task');
    announce(`${task.title || 'Task'} deleted`);
    setPendingCardDelete(null);
  };

  const duplicate = (task: BoardTask) => {
    const { model: next, taskId } = duplicateTask(model, task.id);
    onChange(next);
    if (taskId) setFocusTaskId(taskId);
    announce(`${task.title || 'Task'} duplicated`);
  };

  const copyMarkdown = async (task: BoardTask) => {
    try {
      await navigator.clipboard.writeText(serializeTaskLine(task));
      announce('Task copied as Markdown');
    } catch {
      announce('Could not copy to clipboard');
    }
  };

  // ---- Drag and drop ------------------------------------------------------
  const handleDrop = (col: BoardColumn, beforeId?: string) => {
    const id = draggedId.current;
    draggedId.current = null;
    if (!id) return;
    const dragged = model.tasks.find((t) => t.id === id);
    if (!dragged) return;
    const inThisColumn =
      view === 'workflow' ? dragged.status === col.status : dragged.section === col.section;
    if (inThisColumn) {
      const ids = col.tasks.map((t) => t.id).filter((x) => x !== id);
      let at = beforeId ? ids.indexOf(beforeId) : ids.length;
      if (at < 0) at = ids.length;
      ids.splice(at, 0, id);
      onChange(reorderColumn(model, ids));
      announce(`${dragged.title || 'Task'} reordered in ${col.label}`);
    } else if (view === 'workflow' && col.status) {
      onChange(setTaskStatus(model, id, col.status), `Moved to ${col.label}`);
      announce(`${dragged.title || 'Task'} moved to ${col.label}`);
    } else if (view === 'sections' && col.section) {
      onChange(setTaskSection(model, id, col.section), `Moved to ${col.label}`);
      announce(`${dragged.title || 'Task'} moved to ${col.label}`);
    }
    setFocusTaskId(id);
  };

  // ---- Quick add ----------------------------------------------------------
  const submitQuickAdd = (col: BoardColumn, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    const section = view === 'sections' ? col.section! : (model.sections[0] ?? 'Tasks');
    const status: StatusKey = view === 'workflow' ? (col.status as StatusKey) : 'todo';
    const { model: next, taskId } = addTask(model, section, {
      status,
      title: clean,
      atTop: settings.newCardsAtTop,
    });
    onChange(next);
    setFocusTaskId(taskId);
    announce(`Task "${clean}" added to ${col.label}`);
  };

  // ---- Section management -------------------------------------------------
  const requestSectionDelete = (name: string) => {
    const count = model.tasks.filter((t) => t.section === name).length;
    if (count === 0) {
      if (confirm(`Delete the empty section "${name}"?`)) {
        onChange(removeSection(model, name), 'Deleted section');
        announce(`Section ${name} deleted`);
      }
      return;
    }
    setPendingSectionDelete({ name, count });
  };

  // ---- Copy whole board ---------------------------------------------------
  const copyBoardMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(serializeModel(model, marker));
      announce('Board copied as Markdown');
    } catch {
      announce('Could not copy to clipboard');
    }
    setMenuOpen(false);
  };

  const emptyBoard = model.tasks.length === 0;

  return (
    <section className="pdt-board" role="region" aria-label="Task board">
      <header className="pdt-board__header">
        <div className="pdt-board__row pdt-board__row--primary">
          <span className="pdt-logo" aria-hidden="true">
            ✓
          </span>
          <input
            className="pdt-board__title-input"
            value={model.title ?? ''}
            placeholder="Untitled board"
            aria-label="Board title"
            onChange={(e) => onChange(setTitle(model, e.target.value))}
          />

          <div className="pdt-progress-summary" title={`${done} of ${total} tasks completed`}>
            <span className="pdt-progress-summary__text">
              {done}/{total} done · {pct}%
            </span>
            {settings.showProgressBar && (
              <span className="pdt-progress" aria-hidden="true">
                <span className="pdt-progress__bar" style={{ width: `${pct}%` }} />
              </span>
            )}
          </div>

          <div className="pdt-board__spacer" />

          <SaveIndicator state={saveState} onRetry={onRetry} />

          <button className="pdt-btn pdt-btn-primary" onClick={onClose}>
            Back to document
          </button>

          <div className="pdt-menu">
            <button
              type="button"
              className="pdt-btn pdt-btn-icon"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="pdt-menu__panel" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="pdt-menu__item"
                  onClick={copyBoardMarkdown}
                >
                  Copy board as Markdown
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="pdt-menu__item"
                  onClick={() => {
                    onReloadFromDoc();
                    setMenuOpen(false);
                  }}
                >
                  Reload from document
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pdt-board__row pdt-board__row--tools">
          <div className="pdt-segment" role="tablist" aria-label="Board view">
            <button
              role="tab"
              aria-selected={view === 'workflow'}
              className={`pdt-segment__btn ${view === 'workflow' ? 'is-active' : ''}`}
              onClick={() => onViewChange('workflow')}
            >
              Workflow
            </button>
            <button
              role="tab"
              aria-selected={view === 'sections'}
              className={`pdt-segment__btn ${view === 'sections' ? 'is-active' : ''}`}
              onClick={() => onViewChange('sections')}
            >
              Sections
            </button>
          </div>

          <input
            type="search"
            className="pdt-input pdt-search"
            value={filters.search}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />

          <FilterPanel
            filters={filters}
            facets={facets}
            statusColumns={statusColumns}
            onChange={onFiltersChange}
            onClear={() => onFiltersChange({ ...EMPTY_FILTERS })}
          />

          {filtersActive && (
            <button
              type="button"
              className="pdt-btn pdt-btn-sm"
              onClick={() => onFiltersChange({ ...EMPTY_FILTERS })}
            >
              Clear filters
            </button>
          )}
        </div>
      </header>

      {saveState === 'conflict' && (
        <div className="pdt-banner pdt-banner--warning" role="alert">
          <span className="pdt-banner__text">
            The underlying document changed while the board was open.
          </span>
          <div className="pdt-banner__actions">
            <button className="pdt-btn pdt-btn-sm" onClick={onReloadFromDoc}>
              Reload from document
            </button>
            <button className="pdt-btn pdt-btn-sm" onClick={onOverwriteDoc}>
              Keep board version
            </button>
            <button className="pdt-btn pdt-btn-sm" onClick={onDismissConflict}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {emptyBoard && (
        <div className="pdt-empty pdt-empty--board" role="note">
          <p className="pdt-empty__title">No tasks yet</p>
          <p className="pdt-empty__hint">
            Add your first task with the “Add task” button in any column below.
          </p>
        </div>
      )}

      <div className="pdt-columns">
          {columns.map((col) => {
            const isDoneCol = view === 'workflow' && col.status === 'done';
            const collapsed = isDoneCol && doneCollapsed;
            const visibleTasks = filtersActive
              ? col.tasks.filter((t) => matchesFilters(t, filters, now))
              : col.tasks;
            return (
              <div
                className={`pdt-column ${collapsed ? 'pdt-column--collapsed' : ''}`}
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(col);
                }}
              >
                <div className="pdt-column__head">
                  {view === 'sections' ? (
                    <input
                      className="pdt-column__name-input"
                      value={col.label}
                      aria-label={`Section name: ${col.label}`}
                      onChange={(e) => onChange(renameSection(model, col.key, e.target.value))}
                    />
                  ) : (
                    <span className="pdt-column__name">{col.label}</span>
                  )}
                  <span className="pdt-column__count" aria-label={`${col.tasks.length} tasks`}>
                    {filtersActive
                      ? `${visibleTasks.length}/${col.tasks.length}`
                      : col.tasks.length}
                  </span>

                  {isDoneCol && (
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon"
                      aria-expanded={!collapsed}
                      aria-label={collapsed ? 'Expand Done column' : 'Collapse Done column'}
                      onClick={() => setDoneCollapsed((v) => !v)}
                    >
                      {collapsed ? '▸' : '▾'}
                    </button>
                  )}

                  {view === 'sections' && (
                    <div className="pdt-column__ops">
                      <button
                        type="button"
                        className="pdt-btn pdt-btn-icon"
                        aria-label="Move section left"
                        disabled={model.sections.indexOf(col.key) === 0}
                        onClick={() => onChange(moveSection(model, col.key, -1))}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="pdt-btn pdt-btn-icon"
                        aria-label="Move section right"
                        disabled={model.sections.indexOf(col.key) === model.sections.length - 1}
                        onClick={() => onChange(moveSection(model, col.key, 1))}
                      >
                        ›
                      </button>
                      <button
                        type="button"
                        className="pdt-btn pdt-btn-icon"
                        aria-label={`Delete section ${col.label}`}
                        onClick={() => requestSectionDelete(col.key)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {!collapsed && (
                  <div className="pdt-column__body">
                    {visibleTasks.map((task, i) => (
                      <EditableTaskCard
                        key={task.id}
                        task={task}
                        statusColumns={statusColumns}
                        sections={model.sections}
                        density={settings.density}
                        showDescriptionPreview={settings.showDescriptionPreview}
                        now={now}
                        position={{ index: i, count: visibleTasks.length }}
                        focus={focusTaskId === task.id}
                        onFocusHandled={() => setFocusTaskId(null)}
                        onToggleDone={() => toggleDone(task)}
                        onPatch={(patch) => patchTask(task.id, patch)}
                        onSetStatus={(s) => setStatus(task, s)}
                        onSetSection={(s) => setSection(task, s)}
                        onMoveWithin={(delta) => moveWithin(col, task, delta)}
                        onDuplicate={() => duplicate(task)}
                        onDelete={() => requestDelete(task)}
                        onCopyMarkdown={() => void copyMarkdown(task)}
                        onDragStartCard={() => (draggedId.current = task.id)}
                        onDropOnCard={() => handleDrop(col, task.id)}
                      />
                    ))}

                    {visibleTasks.length === 0 && (
                      <p className="pdt-column__empty">
                        {filtersActive && col.tasks.length > 0
                          ? 'No tasks match the filters.'
                          : 'No tasks yet.'}
                      </p>
                    )}

                    <QuickAdd
                      open={adding === col.key}
                      label={col.label}
                      onOpen={() => setAdding(col.key)}
                      onCancel={() => setAdding(null)}
                      onSubmit={(title) => submitQuickAdd(col, title)}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {view === 'sections' && (
            <div className="pdt-column pdt-column--add">
              <button
                type="button"
                className="pdt-add-column"
                onClick={() => {
                  const next = addSection(model);
                  onChange(next);
                  announce('Section added');
                }}
              >
                + Add section
              </button>
            </div>
          )}
      </div>

      {undoLabel && (
        <div className="pdt-toast" role="status">
          <span>{undoLabel}</span>
          <button type="button" className="pdt-link pdt-toast__undo" onClick={onUndo}>
            Undo
          </button>
        </div>
      )}

      {pendingCardDelete && (
        <Dialog title="Delete task" onClose={() => setPendingCardDelete(null)}>
          <p className="pdt-modal__text">
            Delete “{pendingCardDelete.title || 'this task'}”? You can undo this right after.
          </p>
          <div className="pdt-modal__actions">
            <button className="pdt-btn" onClick={() => setPendingCardDelete(null)}>
              Cancel
            </button>
            <button
              className="pdt-btn pdt-btn-primary pdt-btn-danger"
              onClick={() => confirmDeleteCard(pendingCardDelete)}
            >
              Delete
            </button>
          </div>
        </Dialog>
      )}

      {pendingSectionDelete && (
        <SectionDeleteDialog
          info={pendingSectionDelete}
          sections={model.sections.filter((s) => s !== pendingSectionDelete.name)}
          onCancel={() => setPendingSectionDelete(null)}
          onMove={(target) => {
            onChange(
              removeSectionMovingTasks(model, pendingSectionDelete.name, target),
              'Deleted section',
            );
            announce(`Section ${pendingSectionDelete.name} deleted, tasks moved to ${target}`);
            setPendingSectionDelete(null);
          }}
          onDeleteAll={() => {
            onChange(removeSection(model, pendingSectionDelete.name), 'Deleted section and tasks');
            announce(`Section ${pendingSectionDelete.name} and its tasks deleted`);
            setPendingSectionDelete(null);
          }}
        />
      )}
    </section>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'error') {
    return (
      <span className="pdt-save pdt-save--error" role="status">
        <span aria-hidden="true">⚠</span> Save failed
        <button type="button" className="pdt-link" onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  }
  if (state === 'conflict') {
    return (
      <span className="pdt-save pdt-save--warning" role="status">
        <span aria-hidden="true">↯</span> Document changed
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="pdt-save pdt-save--saving" role="status">
        Saving…
      </span>
    );
  }
  return (
    <span className="pdt-save pdt-save--saved" role="status">
      <span aria-hidden="true">✓</span> Saved
    </span>
  );
}

interface QuickAddProps {
  open: boolean;
  label: string;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: (title: string) => void;
}

function QuickAdd({ open, label, onOpen, onCancel, onSubmit }: QuickAddProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setValue('');
  }, [open]);

  if (!open) {
    return (
      <button type="button" className="pdt-add-task" onClick={onOpen}>
        + Add task
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      className="pdt-input pdt-quickadd"
      value={value}
      placeholder={`Add a task to ${label}…`}
      aria-label={`Add a task to ${label}`}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSubmit(value);
          setValue('');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => {
        // An untouched empty quick-add is abandoned silently.
        if (!value.trim()) onCancel();
      }}
    />
  );
}

interface SectionDeleteDialogProps {
  info: PendingSectionDelete;
  sections: string[];
  onCancel: () => void;
  onMove: (target: string) => void;
  onDeleteAll: () => void;
}

function SectionDeleteDialog({
  info,
  sections,
  onCancel,
  onMove,
  onDeleteAll,
}: SectionDeleteDialogProps) {
  const [target, setTarget] = useState(sections[0] ?? '');
  return (
    <Dialog title={`Delete section “${info.name}”`} onClose={onCancel}>
      <p className="pdt-modal__text">
        “{info.name}” has {info.count} {info.count === 1 ? 'task' : 'tasks'}. Choose what to do with
        {info.count === 1 ? ' it' : ' them'}.
      </p>

      {sections.length > 0 && (
        <div className="pdt-modal__choice">
          <label className="pdt-field pdt-field--grow">
            <span className="pdt-field-label">Move tasks to</span>
            <select
              className="pdt-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button className="pdt-btn pdt-btn-primary" onClick={() => onMove(target)}>
            Move tasks &amp; delete section
          </button>
        </div>
      )}

      <div className="pdt-modal__actions">
        <button className="pdt-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="pdt-btn pdt-btn-danger" onClick={onDeleteAll}>
          Delete section &amp; its tasks
        </button>
      </div>
    </Dialog>
  );
}
