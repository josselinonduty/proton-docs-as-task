import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addSection,
  addTask,
  applyBulkAction,
  canLink,
  canSetStatus,
  linksOf,
  linkTasks,
  openBlockers,
  unlinkTasks,
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
import { TaskDetailsPanel, type DetailsFocus } from './TaskDetailsPanel';
import { SectionNameInput } from './SectionNameInput';
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
  onOpenSettings: () => void;
  onClose: () => void;
}

type PendingSectionDelete = { name: string; count: number };

const VIEW_LABELS: { key: BoardView; label: string; hint: string }[] = [
  { key: 'workflow', label: 'Workflow', hint: 'Columns by status (V)' },
  { key: 'sections', label: 'Sections', hint: 'Columns by document heading (V)' },
  { key: 'swimlane', label: 'Swimlane', hint: 'Status columns × section rows (V)' },
  { key: 'list', label: 'List', hint: 'Simple checklist (V)' },
];

/** Order in which the V shortcut cycles through views. */
const VIEW_ORDER: BoardView[] = ['workflow', 'sections', 'swimlane', 'list'];

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
  const [details, setDetails] = useState<{ id: string; focus: DetailsFocus; nonce: number } | null>(
    null,
  );
  const [trail, setTrail] = useState<string[]>([]);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const [focusSection, setFocusSection] = useState<string | null>(null);

  const draggedId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; beforeId: string | null } | null>(
    null,
  );
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

  // The task shown in the details panel was deleted (here or elsewhere).
  useEffect(() => {
    if (details && !model.tasks.some((t) => t.id === details.id)) setDetails(null);
  }, [details, model]);

  useEffect(() => {
    if (!blockedNotice) return;
    const t = setTimeout(() => setBlockedNotice(null), 4000);
    return () => clearTimeout(t);
  }, [blockedNotice]);

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

  /** True when `task` may take `status`; otherwise explains which tasks stand in the way. */
  const allowStatus = (task: BoardTask, status: StatusKey) => {
    if (canSetStatus(model, task, status)) return true;
    const names = openBlockers(model, task).map((t) => `“${t.title || 'Untitled task'}”`);
    const message = `Blocked by ${names.join(', ')}. Finish ${names.length === 1 ? 'it' : 'them'} first.`;
    setBlockedNotice(message);
    announce(message);
    return false;
  };

  const toggleDone = (task: BoardTask) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    if (!allowStatus(task, next)) return;
    onChange(
      setTaskStatus(model, task.id, next),
      task.status === 'done' ? 'Reopened task' : 'Completed task',
    );
    announce(`${task.title || 'Task'} ${next === 'done' ? 'completed' : 'reopened'}`);
  };

  const setStatus = (task: BoardTask, status: StatusKey) => {
    if (status === task.status || !allowStatus(task, status)) return;
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
    // The card (and maybe the details panel) is gone; keep keyboard focus on the board.
    if (details?.id === task.id) setDetails(null);
    requestAnimationFrame(() => boardRef.current?.focus());
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
  const endDrag = () => {
    draggedId.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  /** Only update on change so hovering does not re-render on every dragover. */
  const hoverTarget = (key: string, beforeId: string | null) =>
    setDropTarget((prev) =>
      prev?.key === key && prev.beforeId === beforeId ? prev : { key, beforeId },
    );

  /** Pointer position alone decides the slot: first remaining card whose midpoint is below it. */
  const cardBefore = (container: HTMLElement, y: number): string | null => {
    for (const card of container.querySelectorAll<HTMLElement>('[data-task-id]')) {
      if (card.dataset.taskId === draggedId.current) continue;
      const { top, height } = card.getBoundingClientRect();
      if (y < top + height / 2) return card.dataset.taskId ?? null;
    }
    return null;
  };

  // Hiding the source synchronously in dragstart makes browsers cancel the drag.
  const startDrag = (id: string) => {
    draggedId.current = id;
    setTimeout(() => draggedId.current === id && setDraggingId(id));
  };

  const handleDrop = (col: BoardColumn) => {
    const id = draggedId.current;
    const beforeId = dropTarget?.key === col.key ? dropTarget.beforeId : null;
    endDrag();
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
      if (!allowStatus(dragged, col.status)) return;
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
    endDrag();
    if (!id || sortActive) return;
    const dragged = model.tasks.find((t) => t.id === id);
    if (!dragged) return;
    if (dragged.status !== status && !allowStatus(dragged, status)) return;
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
    const next = applyBulkAction(model, ids, action);
    onChange(next, label);
    announce(label);
    const target =
      action.kind === 'complete' ? 'done' : action.kind === 'status' ? action.status : null;
    const skipped = target
      ? ids.filter((id) => next.tasks.find((t) => t.id === id)?.status !== target).length
      : 0;
    if (skipped) {
      setBlockedNotice(
        `${skipped} blocked ${skipped === 1 ? 'task was' : 'tasks were'} left as is.`,
      );
    }
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
      // Nothing to lose and the toast offers Undo — no confirmation needed.
      onChange(removeSection(model, name), `Deleted section “${name}”`);
      announce(`Section ${name} deleted`);
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

  const clearFocusSection = useCallback(() => setFocusSection(null), []);

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
  const cardMetaRef = useRef<
    Map<string, { colKey: string; colLabel: string; ids: string[]; tasks: BoardTask[] }>
  >(new Map());

  const focusCardAt = (delta: number) => {
    const order = navOrderRef.current;
    if (order.length === 0) return;
    const current = focusedCardId ? order.indexOf(focusedCardId) : -1;
    const nextIdx = Math.max(0, Math.min(order.length - 1, current + delta));
    const id = current < 0 ? order[0]! : order[nextIdx]!;
    setFocusTaskId(id);
    setFocusedCardId(id);
  };

  const openDetails = (id: string, focus: DetailsFocus = 'panel') => {
    setTrail([]);
    setDetails((d) => ({ id, focus, nonce: (d?.nonce ?? 0) + 1 }));
  };

  /** Follow a link: open the task in the panel, remembering where we came from. */
  const openLinked = (id: string) => {
    if (details) setTrail((t) => [...t, details.id]);
    setDetails((d) => ({ id, focus: 'panel', nonce: (d?.nonce ?? 0) + 1 }));
  };

  const goBack = () => {
    const rest = trail.filter((id) => model.tasks.some((t) => t.id === id));
    const id = rest.pop();
    setTrail(rest);
    if (id) setDetails((d) => ({ id, focus: 'panel', nonce: (d?.nonce ?? 0) + 1 }));
  };

  const closeDetails = () => {
    if (details) setFocusTaskId(details.id);
    setDetails(null);
  };

  const anyOverlayOpen =
    paletteOpen ||
    helpOpen ||
    quickAddOpen ||
    pendingCardDelete != null ||
    pendingBulkDelete ||
    pendingSectionDelete != null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const typing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;
    const mod = e.metaKey || e.ctrlKey;
    // Card shortcuts (Enter, E, M, X, Space, Delete) act only on a card that
    // actually has focus — never on a button that happens to follow one.
    const cardId = target.classList.contains('pdt-taskcard') ? focusedCardId : null;

    // Always-available shortcuts (work even while typing).
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      setPaletteOpen(true);
      return;
    }

    if (anyOverlayOpen) return; // sub-dialogs handle their own keys

    if (e.key === 'Escape') {
      if (sortOpen) return setSortOpen(false);
      if (details) return closeDetails();
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
        if (cardId) {
          e.preventDefault();
          openDetails(cardId);
        }
        break;
      case 'e':
      case 'E':
        if (cardId) {
          e.preventDefault();
          openDetails(cardId, 'title');
        }
        break;
      case 'm':
      case 'M':
        if (cardId) {
          e.preventDefault();
          openDetails(cardId, 'section');
        }
        break;
      case 'x':
      case 'X': {
        const t = cardId ? model.tasks.find((x) => x.id === cardId) : undefined;
        if (t) {
          e.preventDefault();
          toggleDone(t);
        }
        break;
      }
      case ' ': {
        const meta = cardId ? cardMetaRef.current.get(cardId) : undefined;
        const t = cardId ? model.tasks.find((x) => x.id === cardId) : undefined;
        if (t && meta) {
          e.preventDefault();
          toggleSelect(t, meta.colKey, meta.ids, false);
        }
        break;
      }
      case 'Delete':
      case 'Backspace': {
        const t = cardId ? model.tasks.find((x) => x.id === cardId) : undefined;
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

  const mod = modLabel();
  const progress = countTasks(model);
  const detailsTask = details ? model.tasks.find((t) => t.id === details.id) : undefined;
  // Read after the columns render (they fill `cardMetaRef`), so it's current.
  const positionOf = (id: string) => {
    const meta = cardMetaRef.current.get(id);
    return meta ? { index: meta.ids.indexOf(id), count: meta.ids.length } : null;
  };

  return (
    <section
      className={`pdt-board ${selectionMode ? 'pdt-board--selecting' : ''}`}
      role="region"
      aria-label="Task board"
      tabIndex={-1}
      ref={boardRef}
      onKeyDown={handleKeyDown}
    >
      <header className="pdt-board__header">
        <div className="pdt-board__row pdt-board__row--top">
          <button
            type="button"
            className="pdt-btn pdt-btn-ghost pdt-btn-sm pdt-board__back"
            onClick={onClose}
            title="Back to document"
          >
            <Icon name="arrow-left" size={14} />
            <span>Document</span>
          </button>

          <div className="pdt-board__titlewrap">
            <h1 className="pdt-board__title">{model.title || 'Task board'}</h1>
            <BoardProgress done={progress.done} total={progress.total} />
          </div>

          <div className="pdt-board__spacer" />

          <SaveIndicator state={saveState} onRetry={onRetry} />

          <button
            className="pdt-btn pdt-btn-primary"
            onClick={() => setQuickAddOpen(true)}
            aria-haspopup="dialog"
            title="Add task (N)"
          >
            <Icon name="plus" size={16} />
            Add task
          </button>

          <div className="pdt-menu" ref={menuRef}>
            <button
              type="button"
              className="pdt-btn pdt-btn-icon"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              title="More actions"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name="dots-vertical" />
            </button>
            {menuOpen && (
              <div className="pdt-menu__panel" role="menu">
                <MenuItem
                  label={selectionMode ? 'Exit selection' : 'Select tasks'}
                  hint={`${mod} A`}
                  onClick={() => {
                    if (selectionMode) exitSelection();
                    else setSelectionMode(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem label="Copy board as Markdown" onClick={copyBoardMarkdown} />
                <MenuItem
                  label="Reload from document"
                  onClick={() => {
                    onReloadFromDoc();
                    setMenuOpen(false);
                  }}
                />
                <div className="pdt-menu__sep" role="separator" />
                <MenuItem
                  label="Command palette"
                  hint={`${mod} K`}
                  onClick={() => {
                    setPaletteOpen(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label="Keyboard shortcuts"
                  hint="?"
                  onClick={() => {
                    setHelpOpen(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label="Extension settings"
                  onClick={() => {
                    onOpenSettings();
                    setMenuOpen(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="pdt-board__row pdt-board__row--tools">
          <div className="pdt-segment" role="tablist" aria-label="Board view">
            {VIEW_LABELS.map((v) => (
              <button
                key={v.key}
                role="tab"
                aria-selected={view === v.key}
                className={`pdt-segment__btn ${view === v.key ? 'is-active' : ''}`}
                title={v.hint}
                onClick={() => onViewChange(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="pdt-search">
            <Icon name="magnifier" size={16} className="pdt-search__icon" />
            <input
              ref={searchRef}
              type="search"
              className="pdt-input pdt-search__input"
              value={filters.search}
              placeholder="Search tasks"
              aria-label="Search tasks"
              aria-keyshortcuts="/"
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && filters.search) {
                  e.stopPropagation();
                  onFiltersChange({ ...filters, search: '' });
                }
              }}
            />
            <kbd className="pdt-search__kbd" aria-hidden="true">
              /
            </kbd>
          </div>

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

          <FilterBar
            filters={filters}
            presets={presets}
            statusColumns={statusColumns}
            onChange={onFiltersChange}
            onApplyPreset={(preset: Preset) => {
              onFiltersChange(preset.filters);
              if (preset.recommendedSort) onSortChange(preset.recommendedSort);
            }}
            onUnavailablePreset={(preset: Preset) => {
              announce(preset.reason ?? `${preset.label} is unavailable`);
              onOpenSettings();
            }}
          />
        </div>
      </header>

      {quickAddOpen && (
        <Dialog title="New task" size="lg" onClose={() => setQuickAddOpen(false)}>
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
        </Dialog>
      )}

      {blockedNotice && (
        <div className="pdt-banner pdt-banner--info" role="status">
          <span className="pdt-banner__text">{blockedNotice}</span>
          <div className="pdt-banner__actions">
            <button
              className="pdt-btn pdt-btn-sm pdt-btn-ghost"
              onClick={() => setBlockedNotice(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
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
            <button
              className="pdt-btn pdt-btn-sm pdt-btn-ghost"
              onClick={() => setHiddenNotice(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="pdt-board__body">
        <div className="pdt-board__main">
          {view === 'swimlane' ? renderSwimlane() : renderColumns(baseColumns)}
        </div>
        {detailsTask && (
          <TaskDetailsPanel
            task={detailsTask}
            statusColumns={statusColumns}
            sections={model.sections}
            assigneeSuggestions={assigneeSuggestions}
            labelSuggestions={labelSuggestions}
            now={now}
            dateFormat={settings.dateFormat}
            position={positionOf(detailsTask.id)}
            focusTarget={details!.focus}
            focusRequest={details!.nonce}
            links={linksOf(model, detailsTask)}
            openBlockers={openBlockers(model, detailsTask).length}
            linkCandidates={(kind) =>
              model.tasks.filter((t) => canLink(model, detailsTask.id, t.id, kind))
            }
            onBack={trail.length ? goBack : undefined}
            onOpenLinked={openLinked}
            onLink={(kind, id) => {
              onChange(linkTasks(model, detailsTask.id, id, kind), 'Linked tasks');
              announce('Tasks linked');
            }}
            onUnlink={(id) => onChange(unlinkTasks(model, detailsTask.id, id), 'Unlinked tasks')}
            onPatch={(patch) => patchTask(detailsTask.id, patch)}
            onToggleDone={() => toggleDone(detailsTask)}
            onSetStatus={(st) => setStatus(detailsTask, st)}
            onSetSection={(sec) => setSection(detailsTask, sec)}
            onMoveWithin={(delta) => {
              const meta = cardMetaRef.current.get(detailsTask.id);
              if (meta) moveWithin(meta.tasks, meta.colLabel, detailsTask, delta);
            }}
            onDuplicate={() => duplicate(detailsTask)}
            onCopyMarkdown={() => void copyMarkdown(detailsTask)}
            onDelete={() => requestDelete(detailsTask)}
            onClose={closeDetails}
          />
        )}
      </div>

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
              className="pdt-btn pdt-btn-danger-solid"
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
              className="pdt-btn pdt-btn-danger-solid"
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
    dragStart: () => void,
  ) {
    navOrderRef.current.push(task.id);
    cardMetaRef.current.set(task.id, {
      colKey,
      colLabel,
      ids: colVisibleIds,
      tasks: visibleTasks,
    });
    return (
      <EditableTaskCard
        key={task.id}
        task={task}
        statusColumns={statusColumns}
        density={settings.density}
        showDescriptionPreview={settings.showDescriptionPreview}
        cardFields={settings.cardFields}
        dateFormat={settings.dateFormat}
        view={view}
        now={now}
        focus={focusTaskId === task.id}
        active={details?.id === task.id}
        blockedBy={openBlockers(model, task).length}
        blocking={linksOf(model, task).blocks.filter((t) => t.status !== 'done').length}
        highlight={highlightId === task.id}
        selection={
          selectionMode
            ? {
                selected: selected.has(task.id),
                onToggle: (e) => toggleSelect(task, colKey, colVisibleIds, e.shiftKey),
              }
            : null
        }
        dragDisabled={sortActive || view === 'list'}
        onFocusCard={() => setFocusedCardId(task.id)}
        onFocusHandled={() => setFocusTaskId(null)}
        onToggleDone={() => toggleDone(task)}
        onOpen={() => openDetails(task.id)}
        onMoveWithin={(delta) => moveWithin(visibleTasks, colLabel, task, delta)}
        onDragStartCard={dragStart}
        dragging={draggingId === task.id}
        onDragEndCard={endDrag}
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
      <div className={`pdt-columns ${view === 'list' ? 'pdt-columns--list' : ''}`}>
        {columns.map((col) => {
          const isDoneCol = view === 'workflow' && col.status === 'done';
          const collapsed = collapsedColumns.includes(col.key);
          const visibleTasks = visibleOf(col);
          const visibleIds = visibleTasks.map((t) => t.id);
          return (
            <div
              className={`pdt-column ${collapsed ? 'pdt-column--collapsed' : ''}`}
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedId.current) hoverTarget(col.key, cardBefore(e.currentTarget, e.clientY));
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col);
              }}
            >
              <div className="pdt-column__head">
                <button
                  type="button"
                  className="pdt-btn pdt-btn-icon pdt-btn-sm"
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? `Expand ${col.label}` : `Collapse ${col.label}`}
                  title={collapsed ? 'Expand' : 'Collapse'}
                  onClick={() => onToggleColumnCollapse(col.key)}
                >
                  <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
                </button>
                {view === 'sections' ? (
                  <SectionNameInput
                    name={col.key}
                    otherNames={model.sections.filter((x) => x !== col.key)}
                    autoFocus={focusSection === col.key}
                    onFocusHandled={clearFocusSection}
                    onRename={(next, viaKeyboard) => {
                      onChange(renameSection(model, col.key, next), `Renamed section to “${next}”`);
                      announce(`Section renamed to ${next}`);
                      if (viaKeyboard) setFocusSection(next);
                    }}
                    onInvalid={announce}
                  />
                ) : (
                  <span className="pdt-column__name">{col.label}</span>
                )}
                <span
                  className="pdt-column__count"
                  aria-label={
                    filtersActive || hideCompleted
                      ? `${visibleTasks.length} of ${col.tasks.length} tasks shown`
                      : `${col.tasks.length} tasks`
                  }
                >
                  {filtersActive || hideCompleted
                    ? `${visibleTasks.length}/${col.tasks.length}`
                    : col.tasks.length}
                </span>

                {view === 'sections' && (
                  <div className="pdt-column__ops">
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon pdt-btn-sm"
                      aria-label={`Move ${col.label} left`}
                      title="Move left"
                      disabled={model.sections.indexOf(col.key) === 0}
                      onClick={() => onChange(moveSection(model, col.key, -1))}
                    >
                      <Icon name="chevron-left" />
                    </button>
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon pdt-btn-sm"
                      aria-label={`Move ${col.label} right`}
                      title="Move right"
                      disabled={model.sections.indexOf(col.key) === model.sections.length - 1}
                      onClick={() => onChange(moveSection(model, col.key, 1))}
                    >
                      <Icon name="chevron-right" />
                    </button>
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon pdt-btn-sm"
                      aria-label={`Delete section ${col.label}`}
                      title="Delete section"
                      onClick={() => requestSectionDelete(col.key)}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                )}
              </div>

              {!collapsed && (
                <div className="pdt-column__body" role="list" aria-label={col.label}>
                  {visibleTasks.map((task) => (
                    <Fragment key={task.id}>
                      {dropTarget?.key === col.key && dropTarget.beforeId === task.id && (
                        <DropPlaceholder />
                      )}
                      {renderCard(task, col.key, col.label, visibleIds, visibleTasks, () =>
                        startDrag(task.id),
                      )}
                    </Fragment>
                  ))}
                  {dropTarget?.key === col.key && dropTarget.beforeId === null && (
                    <DropPlaceholder />
                  )}

                  {visibleTasks.length === 0 && (
                    <p className="pdt-column__empty">
                      {(filtersActive || hideCompleted) && col.tasks.length > 0
                        ? 'No tasks match the filters.'
                        : 'No tasks yet.'}
                    </p>
                  )}
                </div>
              )}
              {!collapsed && !isDoneCol && (
                <div className="pdt-column__foot">
                  <QuickAdd
                    open={adding === col.key}
                    label={col.label}
                    onOpen={() => setAdding(col.key)}
                    onCancel={() => setAdding(null)}
                    onSubmit={(title) => submitColumnQuickAdd(col, title)}
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
        <div
          className="pdt-swimlane__head"
          role="row"
          style={{ '--pdt-swimlane-cols': statusColumns.length } as React.CSSProperties}
        >
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
            <div
              key={section}
              className="pdt-swimlane__row"
              role="row"
              style={{ '--pdt-swimlane-cols': statusColumns.length } as React.CSSProperties}
            >
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
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedId.current) hoverTarget(cellCol.key, null);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                            setDropTarget(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleSwimlaneDrop(section, c.key);
                        }}
                      >
                        {visibleTasks.map((task) =>
                          renderCard(
                            task,
                            cellCol.key,
                            cellCol.label,
                            visibleIds,
                            visibleTasks,
                            () => startDrag(task.id),
                          ),
                        )}
                        {dropTarget?.key === cellCol.key && <DropPlaceholder />}
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

function DropPlaceholder() {
  return <div className="pdt-drop-placeholder" aria-hidden="true" />;
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
      keywords: 'workflow sections swimlane list',
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

function MenuItem({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="pdt-menu__item" onClick={onClick}>
      <span>{label}</span>
      {hint && <kbd className="pdt-menu__hint">{hint}</kbd>}
    </button>
  );
}

/** Board completion summary next to the title: "4 of 12 done" with a bar. */
function BoardProgress({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <span className="pdt-progress" title={`${pct}% complete`}>
      <span
        className="pdt-progress__bar"
        role="progressbar"
        aria-label="Tasks completed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span className="pdt-progress__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="pdt-progress__text">
        {done} of {total} done
      </span>
    </span>
  );
}

/**
 * Save state indicator. Proton Docs shows its own "Saved / Saving" status, so
 * the board only surfaces the states Proton can't: a failed write (with a
 * retry action) and edits waiting for Proton to unlock editing. The normal
 * saved/saving states render nothing.
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
  if (state === 'paused') {
    return (
      <span
        className="pdt-save pdt-save--warning"
        role="status"
        title="Proton Docs has editing paused (still loading, offline, or view-only). Your changes will be saved as soon as editing resumes."
      >
        <Icon name="exclamation-circle" size={14} /> Waiting to save
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
