import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addSection,
  addTask,
  applyBulkAction,
  columnsForView,
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
  updateTask,
  type BulkAction,
  type BoardColumn,
  type BoardModel,
  type BoardTask,
} from '../lib/model';
import {
  buildPresets,
  collectFacets,
  hasActiveFilters,
  matchesFilters,
  EMPTY_FILTERS,
  type FilterState,
  type Preset,
} from '../lib/filters';
import {
  applySortToModel,
  isActiveSort,
  MANUAL_SORT,
  sortTasks,
  type SortState,
} from '../lib/sorting';
import { buildAssigneeIndex, buildLabelIndex } from '../lib/suggestions';
import { modLabel } from '../lib/platform';
import type { BoardView, SaveState, Settings, StatusKey } from '../lib/types';
import { EditableTaskCard } from './EditableTaskCard';
import { FilterPanel } from './FilterPanel';
import { FilterBar } from './FilterBar';
import { SortMenu } from './SortMenu';
import { QuickAddForm, type QuickAddPayload } from './QuickAddForm';
import { BulkBar } from './BulkBar';
import { CommandPalette, type Command } from './CommandPalette';
import { ShortcutHelp } from './ShortcutHelp';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

interface EditableBoardProps {
  model: BoardModel;
  view: BoardView;
  filters: FilterState;
  sort: SortState;
  settings: Settings;
  marker: string;
  saveState: SaveState;
  undoLabel: string | null;
  collapsedColumns: string[];
  collapsedRows: string[];
  lastQuickAddSection: string | null;
  announce: (msg: string) => void;
  onChange: (next: BoardModel, undoLabel?: string) => void;
  onViewChange: (v: BoardView) => void;
  onFiltersChange: (f: FilterState) => void;
  onSortChange: (s: SortState) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onToggleColumnCollapse: (key: string) => void;
  onToggleRowCollapse: (key: string) => void;
  onQuickAddSectionChange: (section: string) => void;
  onUndo: () => void;
  onRetry: () => void;
  onReloadFromDoc: () => void;
  onOverwriteDoc: () => void;
  onDismissConflict: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

type PendingSectionDelete = { name: string; count: number };

const VIEW_LABELS: { key: BoardView; label: string }[] = [
  { key: 'workflow', label: 'Workflow' },
  { key: 'sections', label: 'Sections' },
  { key: 'swimlane', label: 'Swimlane' },
];

/** Order in which the V shortcut cycles through views. */
const VIEW_ORDER: BoardView[] = ['workflow', 'sections', 'swimlane'];

export function EditableBoard(props: EditableBoardProps) {
  const {
    model,
    view,
    filters,
    sort,
    settings,
    marker,
    saveState,
    undoLabel,
    collapsedColumns,
    collapsedRows,
    lastQuickAddSection,
    announce,
    onChange,
    onViewChange,
    onFiltersChange,
    onSortChange,
    onSettingsChange,
    onToggleColumnCollapse,
    onToggleRowCollapse,
    onQuickAddSectionChange,
    onUndo,
    onRetry,
    onReloadFromDoc,
    onOverwriteDoc,
    onDismissConflict,
    onOpenSettings,
    onClose,
  } = props;

  const statusColumns = settings.columns;
  const now = new Date();
  const facets = collectFacets(model);
  const filtersActive = hasActiveFilters(filters);
  const sortActive = isActiveSort(sort);
  const hideCompleted = settings.completedDisplay === 'hide';

  const assigneeSuggestions = useMemo(() => buildAssigneeIndex(model), [model]);
  const labelSuggestions = useMemo(() => buildLabelIndex(model), [model]);
  const presets = useMemo(
    () => buildPresets({ userAssignee: settings.userAssignee, canUseCreated: true }),
    [settings.userAssignee],
  );

  // ---- Local UI state -----------------------------------------------------
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // per-column quick-add
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [hiddenNotice, setHiddenNotice] = useState(false);
  const [pendingSectionDelete, setPendingSectionDelete] = useState<PendingSectionDelete | null>(
    null,
  );
  const [pendingCardDelete, setPendingCardDelete] = useState<BoardTask | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cardSignal, setCardSignal] = useState({ id: '', open: 0, edit: 0, move: 0 });

  const draggedId = useRef<string | null>(null);
  const boardRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastSelect = useRef<{ id: string; colKey: string } | null>(null);

  // Focus the board once it opens so keyboard shortcuts fire immediately.
  // Without this, focus stays outside the shadow root (on the page body) and
  // key events never reach the board's onKeyDown handler.
  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  // Close the overflow menu on outside click / Escape. `composedPath` is used
  // because the click's target is retargeted to the shadow host at the
  // document level, which would otherwise always read as an outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !e.composedPath().includes(menuRef.current)) setMenuOpen(false);
    };
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onDocKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onDocKey);
    };
  }, [menuOpen]);

  // Clear the new-task highlight after a moment.
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 1600);
    return () => clearTimeout(t);
  }, [highlightId]);

  // Selection is only meaningful over currently-visible cards.
  const passesView = (t: BoardTask) =>
    (!filtersActive || matchesFilters(t, filters, now)) && !(hideCompleted && t.status === 'done');

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

  const moveWithin = (colTasks: BoardTask[], label: string, task: BoardTask, delta: number) => {
    if (sortActive) return; // manual reordering is disabled while sorted
    const ids = colTasks.map((t) => t.id);
    const i = ids.indexOf(task.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(reorderColumn(model, next));
    announce(`${task.title || 'Task'} moved ${delta < 0 ? 'up' : 'down'} in ${label}`);
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

  // ---- Drag and drop (disabled while a non-manual sort is active) ----------
  const handleDrop = (col: BoardColumn, beforeId?: string) => {
    const id = draggedId.current;
    draggedId.current = null;
    if (!id || sortActive) return;
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

  /** Swimlane drop: a cell fixes both status and section at once. */
  const handleSwimlaneDrop = (section: string, status: StatusKey) => {
    const id = draggedId.current;
    draggedId.current = null;
    if (!id || sortActive) return;
    const dragged = model.tasks.find((t) => t.id === id);
    if (!dragged) return;
    let next = model;
    if (dragged.status !== status) next = setTaskStatus(next, id, status);
    if (dragged.section !== section) next = setTaskSection(next, id, section);
    if (next !== model) {
      const label = statusColumns.find((c) => c.key === status)?.label ?? status;
      onChange(next, `Moved to ${section} / ${label}`);
      announce(`${dragged.title || 'Task'} moved to ${section}, ${label}`);
    }
    setFocusTaskId(id);
  };

  // ---- Quick add (per column) --------------------------------------------
  const submitColumnQuickAdd = (col: BoardColumn, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    const section = view === 'sections' ? col.section! : (model.sections[0] ?? 'Tasks');
    const status: StatusKey = view === 'workflow' ? (col.status as StatusKey) : 'todo';
    const { model: next, taskId } = addTask(model, section, {
      status,
      title: clean,
      atTop: settings.newCardsAtTop,
    });
    onChange(next, 'Added task');
    setFocusTaskId(taskId);
    setHighlightId(taskId);
    announce(`Task "${clean}" added to ${col.label}`);
  };

  // ---- Quick add (header form) -------------------------------------------
  const submitHeaderQuickAdd = (payload: QuickAddPayload) => {
    const { model: withTask, taskId } = addTask(model, payload.section, {
      status: payload.status,
      title: payload.title,
      atTop: settings.newCardsAtTop,
    });
    const next = updateTask(withTask, taskId, {
      due: payload.due,
      priority: payload.priority,
      assignee: payload.assignee,
      labels: payload.labels,
    });
    onChange(next, 'Added task');
    onQuickAddSectionChange(payload.section);
    setFocusTaskId(taskId);
    setHighlightId(taskId);
    announce(`Task "${payload.title}" added`);

    const created = next.tasks.find((t) => t.id === taskId);
    const hiddenByFilters = created
      ? filtersActive && !matchesFilters(created, filters, now)
      : false;
    setHiddenNotice(hiddenByFilters);
  };

  // ---- Bulk actions -------------------------------------------------------
  const bulkIds = () => [...selected].filter((id) => model.tasks.some((t) => t.id === id));

  const runBulk = (action: BulkAction) => {
    const ids = bulkIds();
    if (ids.length === 0) return;
    const label = bulkActionLabel(action, ids.length);
    onChange(applyBulkAction(model, ids, action), label);
    announce(label);
    if (action.kind === 'delete') {
      setSelected(new Set());
      setSelectionMode(false);
    }
  };

  const selectAllVisible = () => {
    const ids = new Set<string>();
    for (const t of model.tasks) if (passesView(t)) ids.add(t.id);
    setSelected(ids);
    setSelectionMode(true);
    announce(`${ids.size} tasks selected`);
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
    lastSelect.current = null;
  };

  const toggleSelect = (
    task: BoardTask,
    colKey: string,
    colVisibleIds: string[],
    shift: boolean,
  ) => {
    setSelectionMode(true);
    setSelected((prev) => {
      const next = new Set(prev);
      const anchor = lastSelect.current;
      if (shift && anchor && anchor.colKey === colKey) {
        const a = colVisibleIds.indexOf(anchor.id);
        const b = colVisibleIds.indexOf(task.id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(colVisibleIds[i]!);
          lastSelect.current = { id: task.id, colKey };
          return next;
        }
      }
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      lastSelect.current = { id: task.id, colKey };
      return next;
    });
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

  const cycleView = () => {
    const i = VIEW_ORDER.indexOf(view);
    const nextView = VIEW_ORDER[(i + 1) % VIEW_ORDER.length]!;
    onViewChange(nextView);
    announce(`${VIEW_LABELS.find((v) => v.key === nextView)?.label} view`);
  };

  const applySortToDocument = () => {
    const cols = columnsForView(model, view === 'swimlane' ? 'sections' : view, statusColumns);
    onChange(applySortToModel(model, cols, sort), 'Applied sort order');
    onSortChange(MANUAL_SORT);
    announce('Sort order applied to the document');
  };

  // ---- Keyboard shortcuts -------------------------------------------------
  const navOrderRef = useRef<string[]>([]);
  const cardMetaRef = useRef<Map<string, { colKey: string; ids: string[] }>>(new Map());

  const focusCardAt = (delta: number) => {
    const order = navOrderRef.current;
    if (order.length === 0) return;
    const current = focusedCardId ? order.indexOf(focusedCardId) : -1;
    const nextIdx = Math.max(0, Math.min(order.length - 1, current + delta));
    const id = current < 0 ? order[0]! : order[nextIdx]!;
    setFocusTaskId(id);
    setFocusedCardId(id);
  };

  const bumpSignal = (kind: 'open' | 'edit' | 'move') => {
    if (!focusedCardId) return;
    setCardSignal((s) => ({ ...s, id: focusedCardId, [kind]: s[kind] + 1 }));
  };

  const anyOverlayOpen = paletteOpen || helpOpen || pendingCardDelete != null || pendingBulkDelete;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const typing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;
    const mod = e.metaKey || e.ctrlKey;

    // Always-available shortcuts (work even while typing).
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      setPaletteOpen(true);
      return;
    }

    if (anyOverlayOpen) return; // sub-dialogs handle their own keys

    if (e.key === 'Escape') {
      if (sortOpen) return setSortOpen(false);
      if (quickAddOpen) return setQuickAddOpen(false);
      if (selectionMode) return exitSelection();
      return;
    }

    if (typing) return; // remaining shortcuts never fire while typing

    if (mod && (e.key === 'z' || e.key === 'Z')) {
      if (undoLabel) {
        e.preventDefault();
        onUndo();
      }
      return;
    }
    if (mod && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      selectAllVisible();
      return;
    }
    if (mod) return; // leave other browser combos alone

    switch (e.key) {
      case 'n':
      case 'N':
        e.preventDefault();
        setQuickAddOpen(true);
        break;
      case '/':
        e.preventDefault();
        searchRef.current?.focus();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        filterBtnRef.current?.click();
        break;
      case 'v':
      case 'V':
        e.preventDefault();
        cycleView();
        break;
      case 's':
      case 'S':
        e.preventDefault();
        setSortOpen((v) => !v);
        break;
      case 'j':
      case 'J':
        e.preventDefault();
        focusCardAt(1);
        break;
      case 'k':
      case 'K':
        e.preventDefault();
        focusCardAt(-1);
        break;
      case 'Enter':
        if (focusedCardId) {
          e.preventDefault();
          bumpSignal('open');
        }
        break;
      case 'e':
      case 'E':
        if (focusedCardId) {
          e.preventDefault();
          bumpSignal('edit');
        }
        break;
      case 'm':
      case 'M':
        if (focusedCardId) {
          e.preventDefault();
          bumpSignal('move');
        }
        break;
      case 'x':
      case 'X': {
        const t = focusedCardId ? model.tasks.find((x) => x.id === focusedCardId) : undefined;
        if (t) {
          e.preventDefault();
          toggleDone(t);
        }
        break;
      }
      case ' ': {
        const meta = focusedCardId ? cardMetaRef.current.get(focusedCardId) : undefined;
        const t = focusedCardId ? model.tasks.find((x) => x.id === focusedCardId) : undefined;
        if (t && meta) {
          e.preventDefault();
          toggleSelect(t, meta.colKey, meta.ids, false);
        }
        break;
      }
      case 'Delete':
      case 'Backspace': {
        const t = focusedCardId ? model.tasks.find((x) => x.id === focusedCardId) : undefined;
        if (selectionMode && selected.size > 0) {
          e.preventDefault();
          setPendingBulkDelete(true);
        } else if (t) {
          e.preventDefault();
          requestDelete(t);
        }
        break;
      }
      case '?':
        e.preventDefault();
        setHelpOpen(true);
        break;
      default:
        break;
    }
  };

  // ---- Column / swimlane projection ---------------------------------------
  const projectionView: BoardView = view === 'swimlane' ? 'sections' : view;
  const baseColumns = columnsForView(model, projectionView, statusColumns);

  // Build the flat keyboard-nav order + per-card selection metadata.
  navOrderRef.current = [];
  cardMetaRef.current = new Map();

  const commands = buildCommands({
    filtersActive,
    saveState,
    hideCompleted,
    doneCollapsed: collapsedColumns.includes('done'),
    setQuickAddOpen,
    focusSearch: () => searchRef.current?.focus(),
    cycleView,
    clearFilters: () => onFiltersChange({ ...EMPTY_FILTERS }),
    openSort: () => setSortOpen(true),
    toggleHideCompleted: () =>
      onSettingsChange({ completedDisplay: hideCompleted ? 'show' : 'hide' }),
    toggleDoneCollapsed: () => onToggleColumnCollapse('done'),
    openSettings: onOpenSettings,
    back: onClose,
    openHelp: () => setHelpOpen(true),
    retry: onRetry,
  });

  const emptyBoard = model.tasks.length === 0;
  const mod = modLabel();

  return (
    <section
      className="pdt-board"
      role="region"
      aria-label="Task board"
      tabIndex={-1}
      ref={boardRef}
      onKeyDown={handleKeyDown}
    >
      <header className="pdt-board__header">
        <div className="pdt-board__row pdt-board__row--primary">
          <div className="pdt-segment" role="tablist" aria-label="Board view">
            {VIEW_LABELS.map((v) => (
              <button
                key={v.key}
                role="tab"
                aria-selected={view === v.key}
                className={`pdt-segment__btn ${view === v.key ? 'is-active' : ''}`}
                onClick={() => onViewChange(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <input
            ref={searchRef}
            type="search"
            className="pdt-input pdt-search"
            value={filters.search}
            placeholder="Search tasks… ( / )"
            aria-label="Search tasks"
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />

          <FilterPanel
            filters={filters}
            facets={facets}
            statusColumns={statusColumns}
            triggerRef={filterBtnRef}
            onChange={onFiltersChange}
            onClear={() => onFiltersChange({ ...EMPTY_FILTERS })}
          />

          <SortMenu
            sort={sort}
            open={sortOpen}
            onOpenChange={setSortOpen}
            onChange={onSortChange}
            onApplyToDocument={applySortToDocument}
          />

          <div className="pdt-board__spacer" />

          <button
            className="pdt-btn pdt-btn-primary"
            onClick={() => setQuickAddOpen((v) => !v)}
            aria-expanded={quickAddOpen}
            title="Add task (N)"
          >
            <Icon name="plus" size={14} />
            Add task
          </button>

          <SaveIndicator state={saveState} onRetry={onRetry} />

          <button className="pdt-btn" onClick={onClose} title="Back to document">
            Back to document
          </button>

          <div className="pdt-menu" ref={menuRef}>
            <button
              type="button"
              className="pdt-btn pdt-btn-icon"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name="dots-vertical" />
            </button>
            {menuOpen && (
              <div className="pdt-menu__panel" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="pdt-menu__item"
                  onClick={() => {
                    setPaletteOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  Command palette ({mod} K)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="pdt-menu__item"
                  onClick={() => {
                    setSelectionMode((v) => !v);
                    setMenuOpen(false);
                  }}
                >
                  {selectionMode ? 'Exit selection mode' : 'Select tasks…'}
                </button>
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
                    setHelpOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  Keyboard shortcuts (?)
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
                <button
                  type="button"
                  role="menuitem"
                  className="pdt-menu__item"
                  onClick={() => {
                    onOpenSettings();
                    setMenuOpen(false);
                  }}
                >
                  <Icon name="cog" size={14} />
                  Extension settings
                </button>
              </div>
            )}
          </div>
        </div>

        <FilterBar
          filters={filters}
          presets={presets}
          statusColumns={statusColumns}
          onChange={onFiltersChange}
          onApplyPreset={(preset: Preset) => {
            onFiltersChange(preset.filters);
            if (preset.recommendedSort) onSortChange(preset.recommendedSort);
          }}
        />
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

      {quickAddOpen && (
        <QuickAddForm
          sections={model.sections}
          statusColumns={statusColumns}
          assigneeSuggestions={assigneeSuggestions}
          labelSuggestions={labelSuggestions}
          defaultSection={
            lastQuickAddSection && model.sections.includes(lastQuickAddSection)
              ? lastQuickAddSection
              : (model.sections[0] ?? 'Tasks')
          }
          now={now}
          dateFormat={settings.dateFormat}
          onSubmit={submitHeaderQuickAdd}
          onClose={() => setQuickAddOpen(false)}
        />
      )}

      {hiddenNotice && (
        <div className="pdt-banner pdt-banner--info" role="status">
          <span className="pdt-banner__text">The new task is hidden by the active filters.</span>
          <div className="pdt-banner__actions">
            <button
              className="pdt-btn pdt-btn-sm"
              onClick={() => {
                onFiltersChange({ ...EMPTY_FILTERS });
                setHiddenNotice(false);
              }}
            >
              Clear filters
            </button>
            <button className="pdt-btn pdt-btn-sm" onClick={() => setHiddenNotice(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {view === 'swimlane' && model.sections.length > 6 && (
        <div className="pdt-banner pdt-banner--info" role="note">
          <span className="pdt-banner__text">
            Swimlane view can be wide with {model.sections.length} sections.
          </span>
          <div className="pdt-banner__actions">
            <button className="pdt-btn pdt-btn-sm" onClick={() => onViewChange('workflow')}>
              Back to Workflow
            </button>
          </div>
        </div>
      )}

      {emptyBoard && (
        <div className="pdt-empty pdt-empty--board" role="note">
          <p className="pdt-empty__title">No tasks yet</p>
          <p className="pdt-empty__hint">
            Add your first task with “+ Add task” above, or the button in any column below.
          </p>
        </div>
      )}

      {view === 'swimlane' ? renderSwimlane() : renderColumns(baseColumns)}

      {selectionMode && (
        <BulkBar
          count={selected.size}
          sections={model.sections}
          statusColumns={statusColumns}
          labelSuggestions={labelSuggestions}
          now={now}
          dateFormat={settings.dateFormat}
          onAction={runBulk}
          onRequestDelete={() => setPendingBulkDelete(true)}
          onSelectAll={selectAllVisible}
          onClear={() => setSelected(new Set())}
          onExit={exitSelection}
        />
      )}

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

      {pendingBulkDelete && (
        <Dialog title="Delete selected tasks" onClose={() => setPendingBulkDelete(false)}>
          <p className="pdt-modal__text">
            Delete {selected.size} selected {selected.size === 1 ? 'task' : 'tasks'}? This is one
            undoable action.
          </p>
          <div className="pdt-modal__actions">
            <button className="pdt-btn" onClick={() => setPendingBulkDelete(false)}>
              Cancel
            </button>
            <button
              className="pdt-btn pdt-btn-primary pdt-btn-danger"
              onClick={() => {
                runBulk({ kind: 'delete' });
                setPendingBulkDelete(false);
              }}
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

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
    </section>
  );

  // ---- Renderers ----------------------------------------------------------

  /** Render one card, recording its nav order + selection metadata. */
  function renderCard(
    task: BoardTask,
    colKey: string,
    colLabel: string,
    colVisibleIds: string[],
    visibleTasks: BoardTask[],
    index: number,
    dropHandler: () => void,
    dragStart: () => void,
  ) {
    navOrderRef.current.push(task.id);
    cardMetaRef.current.set(task.id, { colKey, ids: colVisibleIds });
    return (
      <EditableTaskCard
        key={task.id}
        task={task}
        statusColumns={statusColumns}
        sections={model.sections}
        density={settings.density}
        showDescriptionPreview={settings.showDescriptionPreview}
        cardFields={settings.cardFields}
        dateFormat={settings.dateFormat}
        view={view}
        assigneeSuggestions={assigneeSuggestions}
        labelSuggestions={labelSuggestions}
        now={now}
        position={{ index, count: visibleTasks.length }}
        focus={focusTaskId === task.id}
        highlight={highlightId === task.id}
        signals={cardSignal.id === task.id ? cardSignal : undefined}
        selection={
          selectionMode
            ? {
                selected: selected.has(task.id),
                onToggle: (e) => toggleSelect(task, colKey, colVisibleIds, e.shiftKey),
              }
            : null
        }
        dragDisabled={sortActive}
        onFocusCard={() => setFocusedCardId(task.id)}
        onFocusHandled={() => setFocusTaskId(null)}
        onToggleDone={() => toggleDone(task)}
        onPatch={(patch) => patchTask(task.id, patch)}
        onSetStatus={(s) => setStatus(task, s)}
        onSetSection={(s) => setSection(task, s)}
        onMoveWithin={(delta) => moveWithin(visibleTasks, colLabel, task, delta)}
        onDuplicate={() => duplicate(task)}
        onDelete={() => requestDelete(task)}
        onCopyMarkdown={() => void copyMarkdown(task)}
        onDragStartCard={dragStart}
        onDropOnCard={dropHandler}
      />
    );
  }

  function visibleOf(col: BoardColumn): BoardTask[] {
    let list = sortActive ? sortTasks(col.tasks, sort) : col.tasks;
    if (filtersActive) list = list.filter((t) => matchesFilters(t, filters, now));
    if (hideCompleted) list = list.filter((t) => t.status !== 'done');
    return list;
  }

  function renderColumns(columns: BoardColumn[]) {
    return (
      <div className="pdt-columns">
        {columns.map((col) => {
          const isDoneCol = view === 'workflow' && col.status === 'done';
          const collapsed = collapsedColumns.includes(col.key);
          const visibleTasks = visibleOf(col);
          const visibleIds = visibleTasks.map((t) => t.id);
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
                  {filtersActive || hideCompleted
                    ? `${visibleTasks.length}/${col.tasks.length}`
                    : col.tasks.length}
                </span>

                <button
                  type="button"
                  className="pdt-btn pdt-btn-icon"
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? `Expand ${col.label}` : `Collapse ${col.label}`}
                  onClick={() => onToggleColumnCollapse(col.key)}
                >
                  <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
                </button>

                {view === 'sections' && (
                  <div className="pdt-column__ops">
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon"
                      aria-label="Move section left"
                      disabled={model.sections.indexOf(col.key) === 0}
                      onClick={() => onChange(moveSection(model, col.key, -1))}
                    >
                      <Icon name="chevron-left" />
                    </button>
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon"
                      aria-label="Move section right"
                      disabled={model.sections.indexOf(col.key) === model.sections.length - 1}
                      onClick={() => onChange(moveSection(model, col.key, 1))}
                    >
                      <Icon name="chevron-right" />
                    </button>
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon"
                      aria-label={`Delete section ${col.label}`}
                      onClick={() => requestSectionDelete(col.key)}
                    >
                      <Icon name="cross" />
                    </button>
                  </div>
                )}
              </div>

              {!collapsed && (
                <div className="pdt-column__body">
                  {visibleTasks.map((task, i) =>
                    renderCard(
                      task,
                      col.key,
                      col.label,
                      visibleIds,
                      visibleTasks,
                      i,
                      () => handleDrop(col, task.id),
                      () => (draggedId.current = task.id),
                    ),
                  )}

                  {visibleTasks.length === 0 && (
                    <p className="pdt-column__empty">
                      {(filtersActive || hideCompleted) && col.tasks.length > 0
                        ? 'No tasks match the filters.'
                        : 'No tasks yet.'}
                    </p>
                  )}

                  {!isDoneCol && (
                    <QuickAdd
                      open={adding === col.key}
                      label={col.label}
                      onOpen={() => setAdding(col.key)}
                      onCancel={() => setAdding(null)}
                      onSubmit={(title) => submitColumnQuickAdd(col, title)}
                    />
                  )}
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
                onChange(addSection(model));
                announce('Section added');
              }}
            >
              <Icon name="plus" size={14} />
              Add section
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderSwimlane() {
    return (
      <div className="pdt-swimlane" role="table" aria-label="Swimlane board">
        <div className="pdt-swimlane__head" role="row">
          <div className="pdt-swimlane__corner" role="columnheader">
            Section
          </div>
          {statusColumns.map((c) => (
            <div key={c.key} className="pdt-swimlane__colhead" role="columnheader">
              {c.label}
            </div>
          ))}
        </div>

        {model.sections.map((section) => {
          const rowCollapsed = collapsedRows.includes(section);
          const rowCount = model.tasks.filter((t) => t.section === section).length;
          return (
            <div key={section} className="pdt-swimlane__row" role="row">
              <div className="pdt-swimlane__rowhead" role="rowheader">
                <button
                  type="button"
                  className="pdt-btn pdt-btn-icon"
                  aria-expanded={!rowCollapsed}
                  aria-label={rowCollapsed ? `Expand ${section}` : `Collapse ${section}`}
                  onClick={() => onToggleRowCollapse(section)}
                >
                  <Icon name={rowCollapsed ? 'chevron-right' : 'chevron-down'} />
                </button>
                <span className="pdt-swimlane__rowname">{section}</span>
                <span className="pdt-column__count">{rowCount}</span>
              </div>

              {rowCollapsed
                ? null
                : statusColumns.map((c) => {
                    const cellCol: BoardColumn = {
                      key: `${section}::${c.key}`,
                      label: `${section} / ${c.label}`,
                      status: c.key,
                      section,
                      tasks: model.tasks.filter((t) => t.section === section && t.status === c.key),
                    };
                    const visibleTasks = visibleOf(cellCol);
                    const visibleIds = visibleTasks.map((t) => t.id);
                    return (
                      <div
                        key={c.key}
                        className="pdt-swimlane__cell"
                        role="cell"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleSwimlaneDrop(section, c.key);
                        }}
                      >
                        {visibleTasks.map((task, i) =>
                          renderCard(
                            task,
                            cellCol.key,
                            cellCol.label,
                            visibleIds,
                            visibleTasks,
                            i,
                            () => handleSwimlaneDrop(section, c.key),
                            () => (draggedId.current = task.id),
                          ),
                        )}
                        {visibleTasks.length === 0 && (
                          <p className="pdt-swimlane__empty" aria-hidden="true">
                            +
                          </p>
                        )}
                      </div>
                    );
                  })}
            </div>
          );
        })}
      </div>
    );
  }
}

/** Human label for a bulk action, for the undo toast + announcement. */
function bulkActionLabel(action: BulkAction, count: number): string {
  const n = `${count} ${count === 1 ? 'task' : 'tasks'}`;
  switch (action.kind) {
    case 'complete':
      return `Completed ${n}`;
    case 'status':
      return `Changed status of ${n}`;
    case 'section':
      return `Moved ${n} to ${action.section}`;
    case 'priority':
      return `Set priority of ${n}`;
    case 'assignee':
      return `Set assignee of ${n}`;
    case 'due':
      return `Set due date of ${n}`;
    case 'addLabel':
      return `Labelled ${n} #${action.label}`;
    case 'removeLabel':
      return `Removed #${action.label} from ${n}`;
    case 'delete':
      return `Deleted ${n}`;
  }
}

interface BuildCommandsArgs {
  filtersActive: boolean;
  saveState: SaveState;
  hideCompleted: boolean;
  doneCollapsed: boolean;
  setQuickAddOpen: (v: boolean) => void;
  focusSearch: () => void;
  cycleView: () => void;
  clearFilters: () => void;
  openSort: () => void;
  toggleHideCompleted: () => void;
  toggleDoneCollapsed: () => void;
  openSettings: () => void;
  back: () => void;
  openHelp: () => void;
  retry: () => void;
}

function buildCommands(a: BuildCommandsArgs): Command[] {
  return [
    { id: 'add', title: 'Add task', hint: 'N', run: () => a.setQuickAddOpen(true) },
    { id: 'search', title: 'Search tasks', hint: '/', keywords: 'find', run: a.focusSearch },
    {
      id: 'view',
      title: 'Switch view',
      hint: 'V',
      keywords: 'workflow sections swimlane',
      run: a.cycleView,
    },
    {
      id: 'clear',
      title: 'Clear filters',
      keywords: 'reset',
      disabled: !a.filtersActive,
      disabledReason: 'No filters are active',
      run: a.clearFilters,
    },
    { id: 'sort', title: 'Change sorting', hint: 'S', run: a.openSort },
    {
      id: 'completed',
      title: a.hideCompleted ? 'Show completed tasks' : 'Hide completed tasks',
      keywords: 'done',
      run: a.toggleHideCompleted,
    },
    {
      id: 'collapse-done',
      title: a.doneCollapsed ? 'Expand Done column' : 'Collapse Done column',
      run: a.toggleDoneCollapsed,
    },
    { id: 'settings', title: 'Open settings', run: a.openSettings },
    { id: 'back', title: 'Back to document', run: a.back },
    { id: 'shortcuts', title: 'Open keyboard shortcuts', hint: '?', run: a.openHelp },
    {
      id: 'retry',
      title: 'Retry failed save',
      disabled: a.saveState !== 'error',
      disabledReason: 'The document is saved',
      run: a.retry,
    },
  ];
}

/**
 * Save state indicator. Proton Docs shows its own "Saved / Saving" status, so
 * the board only surfaces the states Proton can't: a failed write (with a
 * retry action) and an external-change conflict. The normal saved/saving
 * states render nothing.
 */
function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'error') {
    return (
      <span className="pdt-save pdt-save--error" role="status">
        <Icon name="exclamation-circle" size={14} /> Save failed
        <button type="button" className="pdt-link" onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  }
  if (state === 'conflict') {
    return (
      <span className="pdt-save pdt-save--warning" role="status">
        <Icon name="exclamation-circle" size={14} /> Document changed
      </span>
    );
  }
  return null;
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
        <Icon name="plus" size={14} />
        Add task
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
          e.stopPropagation();
          onCancel();
        }
      }}
      onBlur={() => {
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
