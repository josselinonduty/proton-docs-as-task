import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  addSection,
  addSubtask,
  addTask,
  applyBulkAction,
  canLink,
  canSetParent,
  canSetStatus,
  isTaskDone,
  linksOf,
  linkTasks,
  openBlockers,
  openSubtasks,
  parentOf,
  setParent,
  subtasksOf,
  unlinkTasks,
  columnsForView,
  countTasks,
  duplicateTask,
  moveSection,
  moveTasksToStatus,
  orphanStatuses,
  toggleDefaultSection,
  removeSection,
  removeSectionMovingTasks,
  removeStatus,
  removeTask,
  renameSection,
  reorderColumn,
  serializeModel,
  serializeTaskLine,
  setTaskSection,
  setTaskStatus,
  updateStatus,
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
import { applySortToModel, isActiveSort, MANUAL_SORT, type SortState } from '../lib/sorting';
import { defaultStatus, findStatus } from '../lib/statuses';
import { buildAssigneeIndex, buildLabelIndex } from '../lib/suggestions';
import { modLabel } from '../lib/platform';
import {
  BOARD_VIEWS,
  type BoardView,
  type SaveState,
  type Settings,
  type StatusDef,
  type StatusKey,
} from '../lib/types';
import { EditableTaskCard } from './EditableTaskCard';
import { TaskDetailsPanel } from './TaskDetailsPanel';
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
import { BoardSettingsDialog } from './BoardSettingsDialog';
import { ColorSwatches, statusStyle } from './StatusColorPicker';
import { MissingStatusDialog, StatusDeleteDialog } from './StatusDialogs';
import { useDismiss } from './useDismiss';
import { useStatusActions } from './useStatusActions';
import { isTaskShown, layoutBoard, type LaidOutBoardColumn } from './board/boardLayout';
import { useNow } from './board/useNow';
import { useBoardOverlay } from './board/useBoardOverlay';
import { useBoardSelection } from './board/useBoardSelection';
import { useDetailsNavigation } from './board/useDetailsNavigation';
import { useBoardDnd } from './board/useBoardDnd';
import { useBoardShortcuts } from './board/useBoardShortcuts';

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

type PendingStatusDelete = { key: StatusKey; count: number };

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

  const { t } = useTranslation();
  const taskName = (task: BoardTask) => task.title || t('board.task');
  const { statuses } = model;
  const statusActions = useStatusActions({ model, onChange, announce });
  const isDone = (task: BoardTask) => isTaskDone(model, task);
  const subtaskProgress = (task: BoardTask) => {
    const subs = subtasksOf(model, task);
    return subs.length
      ? {
          done: subs.filter(isDone).length,
          total: subs.length,
          open: openSubtasks(model, task).length,
        }
      : undefined;
  };
  const now = useNow();
  const facets = useMemo(() => collectFacets(model), [model]);
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
  const [hiddenNotice, setHiddenNotice] = useState(false);
  const {
    overlay,
    open: openOverlay,
    close: closeOverlay,
    isOpen: overlayOpen,
  } = useBoardOverlay();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  // Outside the overlay union, since each stacks on top of an open overlay.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingStatusDelete, setPendingStatusDelete] = useState<PendingStatusDelete | null>(null);
  const selection = useBoardSelection();
  const { selectionMode, selected } = selection;
  const detailsNav = useDetailsNavigation(model.tasks);
  const { details } = detailsNav;
  const dnd = useBoardDnd();
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const [focusSection, setFocusSection] = useState<string | null>(null);
  const [focusStatus, setFocusStatus] = useState<StatusKey | null>(null);
  const [colorMenuFor, setColorMenuFor] = useState<StatusKey | null>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  const boardRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus the board once it opens so keyboard shortcuts fire immediately.
  // Without this, focus stays outside the shadow root (on the page body) and
  // key events never reach the board's onKeyDown handler.
  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  useDismiss(menuOpen, [menuRef], () => setMenuOpen(false), { escape: true });
  useDismiss(colorMenuFor !== null, [colorMenuRef], () => setColorMenuFor(null));

  useEffect(() => {
    if (!blockedNotice) return;
    const timer = setTimeout(() => setBlockedNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [blockedNotice]);

  // Clear the new-task highlight after a moment.
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 1600);
    return () => clearTimeout(timer);
  }, [highlightId]);

  // Selection is only meaningful over currently-visible cards.
  const passesView = (task: BoardTask) => isTaskShown(task, { model, filters, hideCompleted, now });

  // ---- Card mutations -----------------------------------------------------
  const patchTask = (id: string, patch: Partial<Omit<BoardTask, 'id' | 'order'>>) =>
    onChange(updateTask(model, id, patch));

  /** True when `task` may take `status`; otherwise explains which tasks stand in the way. */
  const allowStatus = (task: BoardTask, status: StatusKey) => {
    if (canSetStatus(model, task, status)) return true;
    const blockers = openBlockers(model, task);
    const names = (blockers.length ? blockers : openSubtasks(model, task)).map(
      (b) => `“${b.title || t('card.untitled')}”`,
    );
    const message = t(blockers.length ? 'board.blocked' : 'board.openSubtasks', {
      names: names.join(', '),
      count: names.length,
    });
    setBlockedNotice(message);
    announce(message);
    return false;
  };

  const toggleDone = (task: BoardTask) => {
    const wasDone = isDone(task);
    const next = defaultStatus(statuses, !wasDone);
    if (!allowStatus(task, next)) return;
    onChange(
      setTaskStatus(model, task.id, next),
      t(wasDone ? 'board.undo.reopened' : 'board.undo.completed'),
    );
    announce(t(wasDone ? 'board.reopened' : 'board.completed', { title: taskName(task) }));
  };

  const setStatus = (task: BoardTask, status: StatusKey) => {
    if (status === task.status || !allowStatus(task, status)) return;
    const label = findStatus(statuses, status)?.label ?? status;
    onChange(setTaskStatus(model, task.id, status), t('board.undo.movedTo', { to: label }));
    announce(t('board.movedTo', { title: taskName(task), to: label }));
    setFocusTaskId(task.id);
  };

  const setSection = (task: BoardTask, section: string) => {
    if (section === task.section) return;
    onChange(setTaskSection(model, task.id, section), t('board.undo.movedTo', { to: section }));
    announce(t('board.movedTo', { title: taskName(task), to: section }));
    setFocusTaskId(task.id);
  };

  const moveWithin = (colTasks: BoardTask[], label: string, task: BoardTask, delta: number) => {
    if (sortActive) return; // manual reordering is disabled while sorted
    const ids = colTasks.map((colTask) => colTask.id);
    const i = ids.indexOf(task.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(reorderColumn(model, next));
    announce(
      t(delta < 0 ? 'board.movedUp' : 'board.movedDown', { title: taskName(task), column: label }),
    );
    setFocusTaskId(task.id);
  };

  const requestDelete = (task: BoardTask) => {
    if (settings.confirmDelete) openOverlay({ kind: 'deleteCard', task });
    else confirmDeleteCard(task);
  };

  const confirmDeleteCard = (task: BoardTask) => {
    onChange(removeTask(model, task.id), t('board.undo.deleted'));
    announce(t('board.deleted', { title: taskName(task) }));
    closeOverlay('deleteCard');
    // The card (and maybe the details panel) is gone; keep keyboard focus on the board.
    if (details?.id === task.id) detailsNav.close();
    requestAnimationFrame(() => boardRef.current?.focus());
  };

  const duplicate = (task: BoardTask) => {
    const { model: next, taskId } = duplicateTask(model, task.id);
    onChange(next);
    if (taskId) setFocusTaskId(taskId);
    announce(t('board.duplicated', { title: taskName(task) }));
  };

  const copyMarkdown = async (task: BoardTask) => {
    try {
      await navigator.clipboard.writeText(serializeTaskLine(task, statuses));
      announce(t('board.taskCopied'));
    } catch {
      announce(t('board.copyFailed'));
    }
  };

  // ---- Drag and drop (disabled while a non-manual sort is active) ----------
  const handleDrop = (col: BoardColumn, id: string, beforeId: string | null) => {
    if (sortActive) return;
    const dragged = model.tasks.find((task) => task.id === id);
    if (!dragged) return;
    const inThisColumn =
      view === 'workflow' ? dragged.status === col.status : dragged.section === col.section;
    if (inThisColumn) {
      const ids = col.tasks.map((task) => task.id).filter((x) => x !== id);
      let at = beforeId ? ids.indexOf(beforeId) : ids.length;
      if (at < 0) at = ids.length;
      ids.splice(at, 0, id);
      onChange(reorderColumn(model, ids));
      announce(t('board.reordered', { title: taskName(dragged), column: col.label }));
    } else if (view === 'workflow' && col.status) {
      if (!allowStatus(dragged, col.status)) return;
      onChange(setTaskStatus(model, id, col.status), t('board.undo.movedTo', { to: col.label }));
      announce(t('board.movedTo', { title: taskName(dragged), to: col.label }));
    } else if (view === 'sections' && col.section) {
      onChange(setTaskSection(model, id, col.section), t('board.undo.movedTo', { to: col.label }));
      announce(t('board.movedTo', { title: taskName(dragged), to: col.label }));
    }
    setFocusTaskId(id);
  };

  /** Swimlane drop: a cell fixes both status and section at once. */
  const handleSwimlaneDrop = (section: string, status: StatusKey, id: string) => {
    if (sortActive) return;
    const dragged = model.tasks.find((task) => task.id === id);
    if (!dragged) return;
    if (dragged.status !== status && !allowStatus(dragged, status)) return;
    let next = model;
    if (dragged.status !== status) next = setTaskStatus(next, id, status);
    if (dragged.section !== section) next = setTaskSection(next, id, section);
    if (next !== model) {
      const label = findStatus(statuses, status)?.label ?? status;
      onChange(next, t('board.undo.movedTo', { to: `${section} / ${label}` }));
      announce(t('board.movedTo', { title: taskName(dragged), to: `${section}, ${label}` }));
    }
    setFocusTaskId(id);
  };

  // ---- Quick add (per column) --------------------------------------------
  const openQuickAdd = () => openOverlay({ kind: 'quickAdd', preset: null });

  const openColumnQuickAdd = (col: BoardColumn) =>
    openOverlay({
      kind: 'quickAdd',
      preset:
        view === 'sections'
          ? { section: col.section }
          : view === 'workflow'
            ? { status: col.status }
            : null,
    });

  const closeQuickAdd = () => closeOverlay('quickAdd');

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
    onChange(next, t('board.undo.added'));
    onQuickAddSectionChange(payload.section);
    setFocusTaskId(taskId);
    setHighlightId(taskId);
    announce(t('board.added', { title: payload.title }));

    const created = next.tasks.find((task) => task.id === taskId);
    const hiddenByFilters = created
      ? filtersActive && !matchesFilters(created, filters, now, isDone)
      : false;
    setHiddenNotice(hiddenByFilters);
  };

  // ---- Bulk actions -------------------------------------------------------
  const bulkIds = () => [...selected].filter((id) => model.tasks.some((task) => task.id === id));

  const runBulk = (action: BulkAction) => {
    const ids = bulkIds();
    if (ids.length === 0) return;
    const label = bulkActionLabel(t, action, ids.length);
    const next = applyBulkAction(model, ids, action);
    onChange(next, label);
    announce(label);
    const target = action.kind === 'status' ? action.status : null;
    const reached = (task: BoardTask) =>
      action.kind === 'complete' ? isTaskDone(next, task) : task.status === target;
    const skipped =
      action.kind === 'complete' || target
        ? ids.filter((id) => {
            const task = next.tasks.find((candidate) => candidate.id === id);
            return task && !reached(task);
          }).length
        : 0;
    if (skipped) {
      setBlockedNotice(t('board.skipped', { count: skipped }));
    }
    if (action.kind === 'delete') selection.leave();
  };

  const selectAllVisible = () => {
    const ids = new Set<string>();
    for (const task of model.tasks) if (passesView(task)) ids.add(task.id);
    selection.select(ids);
    announce(t('board.selectedCount', { count: ids.size }));
  };

  const exitSelection = selection.exit;

  const toggleSelect = (task: BoardTask, colKey: string, colVisibleIds: string[], shift: boolean) =>
    selection.toggle(task.id, colKey, colVisibleIds, shift);

  // ---- Section management -------------------------------------------------
  const requestSectionDelete = (name: string) => {
    const count = model.tasks.filter((task) => task.section === name).length;
    if (count === 0) {
      // Nothing to lose and the toast offers Undo — no confirmation needed.
      onChange(removeSection(model, name), t('board.undo.sectionDeleted', { name }));
      announce(t('board.sectionDeleted', { name }));
      return;
    }
    openOverlay({ kind: 'deleteSection', name, count });
  };

  // ---- Status management --------------------------------------------------
  const requestStatusDelete = (key: StatusKey) => {
    const status = findStatus(statuses, key);
    if (!status) return;
    if (!statusActions.canRemove(status)) {
      announce(statusActions.removeHint(status));
      return;
    }
    const count = model.tasks.filter((task) => task.status === key).length;
    if (count === 0) {
      onChange(removeStatus(model, key), t('board.undo.statusDeleted', { label: status.label }));
      announce(t('board.statusDeleted', { label: status.label }));
      return;
    }
    setPendingStatusDelete({ key, count });
  };

  const setStatusColors = (status: StatusDef, patch: Pick<StatusDef, 'color' | 'bg'>) =>
    onChange(
      updateStatus(model, status.key, patch),
      t('board.undo.colors', { label: status.label }),
    );

  const orphans = useMemo(() => orphanStatuses(model), [model]);

  const moveOrphans = (targets: Record<StatusKey, StatusKey>) => {
    let next = model;
    for (const [from, to] of Object.entries(targets)) next = moveTasksToStatus(next, from, to);
    onChange(next, t('board.undo.orphans'));
    announce(t('board.tasksMoved'));
  };

  const doneKeys = statuses.filter((s) => s.category === 'done').map((s) => s.key);
  const doneCollapsed = doneKeys.length > 0 && doneKeys.every((k) => collapsedColumns.includes(k));
  const toggleDoneCollapsed = () => {
    for (const key of doneKeys) {
      if (collapsedColumns.includes(key) === doneCollapsed) onToggleColumnCollapse(key);
    }
  };

  // ---- Copy whole board ---------------------------------------------------
  const copyBoardMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(serializeModel(model, marker));
      announce(t('board.boardCopied'));
    } catch {
      announce(t('board.copyFailed'));
    }
    setMenuOpen(false);
  };

  const clearFocusSection = useCallback(() => setFocusSection(null), []);
  const clearFocusStatus = useCallback(() => setFocusStatus(null), []);

  const cycleView = () => {
    const i = BOARD_VIEWS.indexOf(view);
    const nextView = BOARD_VIEWS[(i + 1) % BOARD_VIEWS.length]!;
    onViewChange(nextView);
    announce(t('board.viewAnnounce', { view: t(`views.${nextView}.label`) }));
  };

  const applySortToDocument = () => {
    const cols = columnsForView(model, view === 'swimlane' ? 'sections' : view);
    onChange(applySortToModel(model, cols, sort), t('board.undo.sortApplied'));
    onSortChange(MANUAL_SORT);
    announce(t('board.sortApplied'));
  };

  // ---- Columns, swimlane rows and the cards they show -----------------------
  // The same layout drives rendering, J / K order and each card's place.
  const layout = useMemo(
    () =>
      layoutBoard({
        model,
        view,
        filters,
        sort,
        hideCompleted,
        now,
        collapsedColumns,
        collapsedRows,
      }),
    [model, view, filters, sort, hideCompleted, now, collapsedColumns, collapsedRows],
  );

  // ---- Keyboard shortcuts -------------------------------------------------
  const focusCardAt = (delta: number) => {
    const order = layout.navOrder;
    if (order.length === 0) return;
    const current = focusedCardId ? order.indexOf(focusedCardId) : -1;
    const nextIdx = Math.max(0, Math.min(order.length - 1, current + delta));
    const id = current < 0 ? order[0]! : order[nextIdx]!;
    setFocusTaskId(id);
    setFocusedCardId(id);
  };

  const openDetails = detailsNav.open;
  const openLinked = detailsNav.openLinked;

  const closeDetails = () => {
    const id = detailsNav.close();
    if (id) setFocusTaskId(id);
  };

  const anyOverlayOpen =
    overlayOpen || paletteOpen || pendingStatusDelete != null || orphans.length > 0;

  const handleKeyDown = useBoardShortcuts({
    overlayOpen: anyOverlayOpen,
    focusedCardId,
    tasks: model.tasks,
    places: layout.places,
    colorMenuOpen: colorMenuFor !== null,
    sortOpen,
    detailsOpen: details !== null,
    selectionMode,
    selectedCount: selected.size,
    canUndo: undoLabel !== null,
    actions: {
      openPalette: () => setPaletteOpen(true),
      closeColorMenu: () => setColorMenuFor(null),
      closeSort: () => setSortOpen(false),
      closeDetails,
      exitSelection,
      undo: onUndo,
      selectAll: selectAllVisible,
      addTask: openQuickAdd,
      focusSearch: () => searchRef.current?.focus(),
      openFilters: () => filterBtnRef.current?.click(),
      cycleView,
      toggleSort: () => setSortOpen((v) => !v),
      focusCard: focusCardAt,
      openDetails,
      toggleDone,
      toggleSelect: (task) => {
        const place = layout.places.get(task.id);
        if (place) toggleSelect(task, place.colKey, place.ids, false);
      },
      requestBulkDelete: () => openOverlay({ kind: 'deleteBulk' }),
      requestDelete,
      openHelp: () => openOverlay({ kind: 'help' }),
    },
  });

  const commands = buildCommands(t, {
    filtersActive,
    saveState,
    hideCompleted,
    doneCollapsed,
    addTask: openQuickAdd,
    focusSearch: () => searchRef.current?.focus(),
    cycleView,
    clearFilters: () => onFiltersChange({ ...EMPTY_FILTERS }),
    openSort: () => setSortOpen(true),
    toggleHideCompleted: () =>
      onSettingsChange({ completedDisplay: hideCompleted ? 'show' : 'hide' }),
    toggleDoneCollapsed,
    openBoardSettings: () => openOverlay({ kind: 'boardSettings' }),
    openSettings: onOpenSettings,
    back: onClose,
    openHelp: () => openOverlay({ kind: 'help' }),
    retry: onRetry,
  });

  const mod = modLabel();
  const progress = useMemo(() => countTasks(model), [model]);
  const statusToDelete = pendingStatusDelete && findStatus(statuses, pendingStatusDelete.key);
  const detailsTask = details ? model.tasks.find((task) => task.id === details.id) : undefined;
  const positionOf = (id: string) => {
    const meta = layout.places.get(id);
    return meta ? { index: meta.ids.indexOf(id), count: meta.ids.length } : null;
  };

  return (
    <section
      className={`pdt-board ${selectionMode ? 'pdt-board--selecting' : ''}`}
      role="region"
      aria-label={t('board.region')}
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
            title={t('board.back')}
          >
            <Icon name="arrow-left" size={14} />
            <span>{t('board.document')}</span>
          </button>

          <div className="pdt-board__titlewrap">
            <h1 className="pdt-board__title">{model.title || t('board.defaultTitle')}</h1>
            <BoardProgress done={progress.done} total={progress.total} />
          </div>

          <div className="pdt-board__spacer" />

          <SaveIndicator state={saveState} onRetry={onRetry} />

          <button
            className="pdt-btn pdt-btn-primary"
            onClick={openQuickAdd}
            aria-haspopup="dialog"
            title={t('board.addTaskKey')}
          >
            <Icon name="plus" size={16} />
            {t('quickAdd.add')}
          </button>

          <div className="pdt-menu" ref={menuRef}>
            <button
              type="button"
              className="pdt-btn pdt-btn-icon"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t('board.more')}
              title={t('board.more')}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Icon name="dots-vertical" />
            </button>
            {menuOpen && (
              <div className="pdt-menu__panel" role="menu">
                <MenuItem
                  label={selectionMode ? t('board.menu.exitSelection') : t('board.menu.select')}
                  hint={`${mod} A`}
                  onClick={() => {
                    if (selectionMode) exitSelection();
                    else selection.start();
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label={t('settings.title')}
                  onClick={() => {
                    openOverlay({ kind: 'boardSettings' });
                    setMenuOpen(false);
                  }}
                />
                <MenuItem label={t('board.menu.copyBoard')} onClick={copyBoardMarkdown} />
                <MenuItem
                  label={t('board.menu.reload')}
                  onClick={() => {
                    onReloadFromDoc();
                    setMenuOpen(false);
                  }}
                />
                <div className="pdt-menu__sep" role="separator" />
                <MenuItem
                  label={t('palette.title')}
                  hint={`${mod} K`}
                  onClick={() => {
                    setPaletteOpen(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label={t('shortcuts.title')}
                  hint="?"
                  onClick={() => {
                    openOverlay({ kind: 'help' });
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  label={t('board.menu.extension')}
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
          <div className="pdt-segment" role="tablist" aria-label={t('board.viewLabel')}>
            {BOARD_VIEWS.map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                className={`pdt-segment__btn ${view === v ? 'is-active' : ''}`}
                title={t(`views.${v}.hint`)}
                onClick={() => onViewChange(v)}
              >
                {t(`views.${v}.label`)}
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
              placeholder={t('board.search')}
              aria-label={t('board.search')}
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
            statuses={statuses}
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
            statuses={statuses}
            onChange={onFiltersChange}
            onApplyPreset={(preset: Preset) => {
              onFiltersChange(preset.filters);
              if (preset.recommendedSort) onSortChange(preset.recommendedSort);
            }}
            onUnavailablePreset={(preset: Preset) => {
              announce(
                preset.reason
                  ? t(`presets.reason.${preset.reason}`)
                  : t('presets.unavailable', { label: t(`presets.${preset.id}`) }),
              );
              onOpenSettings();
            }}
          />
        </div>
      </header>

      {overlay.kind === 'quickAdd' && (
        <Dialog title={t('board.newTask')} size="lg" onClose={closeQuickAdd}>
          <QuickAddForm
            sections={model.sections}
            statuses={statuses}
            assigneeSuggestions={assigneeSuggestions}
            labelSuggestions={labelSuggestions}
            defaultSection={
              overlay.preset?.section && model.sections.includes(overlay.preset.section)
                ? overlay.preset.section
                : lastQuickAddSection && model.sections.includes(lastQuickAddSection)
                  ? lastQuickAddSection
                  : (model.sections[0] ?? 'Tasks')
            }
            defaultStatusKey={overlay.preset?.status}
            now={now}
            dateFormat={settings.dateFormat}
            onSubmit={submitHeaderQuickAdd}
            onClose={closeQuickAdd}
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
              {t('board.dismiss')}
            </button>
          </div>
        </div>
      )}

      {hiddenNotice && (
        <div className="pdt-banner pdt-banner--info" role="status">
          <span className="pdt-banner__text">{t('board.hiddenNotice')}</span>
          <div className="pdt-banner__actions">
            <button
              className="pdt-btn pdt-btn-sm"
              onClick={() => {
                onFiltersChange({ ...EMPTY_FILTERS });
                setHiddenNotice(false);
              }}
            >
              {t('board.clearFilters')}
            </button>
            <button
              className="pdt-btn pdt-btn-sm pdt-btn-ghost"
              onClick={() => setHiddenNotice(false)}
            >
              {t('board.dismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="pdt-board__body">
        <div className="pdt-board__main">
          {view === 'swimlane' ? renderSwimlane() : renderColumns(layout.columns)}
        </div>
        {detailsTask && (
          <TaskDetailsPanel
            task={detailsTask}
            statuses={statuses}
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
              model.tasks.filter((task) => canLink(model, detailsTask.id, task.id, kind))
            }
            openSubtasks={openSubtasks(model, detailsTask).length}
            subtasks={{
              parent: parentOf(model, detailsTask),
              subtasks: subtasksOf(model, detailsTask),
              parentCandidates: () =>
                model.tasks.filter((task) => canSetParent(model, detailsTask.id, task.id)),
              onOpen: openLinked,
              onAdd: (title) => {
                const { model: next } = addSubtask(model, detailsTask.id, title);
                onChange(next, t('board.undo.subtaskAdded'));
                announce(t('board.subtaskAdded', { title, parent: taskName(detailsTask) }));
              },
              onToggleDone: (id) => {
                const sub = model.tasks.find((task) => task.id === id);
                if (sub) toggleDone(sub);
              },
              onDetach: (id) => {
                onChange(setParent(model, id, undefined), t('board.undo.subtaskDetached'));
                announce(t('board.subtaskDetached'));
              },
              onDelete: (id) => {
                const sub = model.tasks.find((task) => task.id === id);
                if (sub) requestDelete(sub);
              },
              onSetParent: (id) => {
                onChange(
                  setParent(model, detailsTask.id, id),
                  t(id ? 'board.undo.parentSet' : 'board.undo.parentRemoved'),
                );
                announce(t(id ? 'board.parentSet' : 'board.parentRemoved'));
              },
            }}
            onBack={detailsNav.canGoBack ? detailsNav.goBack : undefined}
            onOpenLinked={openLinked}
            onLink={(kind, id) => {
              onChange(linkTasks(model, detailsTask.id, id, kind), t('board.undo.linked'));
              announce(t('board.linked'));
            }}
            onUnlink={(id) =>
              onChange(unlinkTasks(model, detailsTask.id, id), t('board.undo.unlinked'))
            }
            onPatch={(patch) => patchTask(detailsTask.id, patch)}
            onToggleDone={() => toggleDone(detailsTask)}
            onSetStatus={(st) => setStatus(detailsTask, st)}
            onSetSection={(sec) => setSection(detailsTask, sec)}
            onMoveWithin={(delta) => {
              const meta = layout.places.get(detailsTask.id);
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
          statuses={statuses}
          labelSuggestions={labelSuggestions}
          now={now}
          dateFormat={settings.dateFormat}
          onAction={runBulk}
          onRequestDelete={() => openOverlay({ kind: 'deleteBulk' })}
          onSelectAll={selectAllVisible}
          onClear={selection.clear}
          onExit={exitSelection}
        />
      )}

      {undoLabel && (
        <div className="pdt-toast" role="status">
          <span>{undoLabel}</span>
          <button type="button" className="pdt-link pdt-toast__undo" onClick={onUndo}>
            {t('board.undo.button')}
          </button>
        </div>
      )}

      {overlay.kind === 'deleteCard' && (
        <Dialog title={t('details.delete')} onClose={() => closeOverlay('deleteCard')}>
          <p className="pdt-modal__text">
            {t('board.confirmDelete', { title: overlay.task.title || t('board.thisTask') })}
          </p>
          <div className="pdt-modal__actions">
            <button className="pdt-btn" onClick={() => closeOverlay('deleteCard')}>
              {t('common.cancel')}
            </button>
            <button
              className="pdt-btn pdt-btn-danger-solid"
              onClick={() => confirmDeleteCard(overlay.task)}
            >
              {t('common.delete')}
            </button>
          </div>
        </Dialog>
      )}

      {overlay.kind === 'deleteBulk' && (
        <Dialog title={t('board.deleteSelected')} onClose={() => closeOverlay('deleteBulk')}>
          <p className="pdt-modal__text">{t('board.confirmBulk', { count: selected.size })}</p>
          <div className="pdt-modal__actions">
            <button className="pdt-btn" onClick={() => closeOverlay('deleteBulk')}>
              {t('common.cancel')}
            </button>
            <button
              className="pdt-btn pdt-btn-danger-solid"
              onClick={() => {
                runBulk({ kind: 'delete' });
                closeOverlay('deleteBulk');
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        </Dialog>
      )}

      {overlay.kind === 'deleteSection' && (
        <SectionDeleteDialog
          info={overlay}
          sections={model.sections.filter((s) => s !== overlay.name)}
          onCancel={() => closeOverlay('deleteSection')}
          onMove={(target) => {
            onChange(
              removeSectionMovingTasks(model, overlay.name, target),
              t('board.undo.sectionMoved'),
            );
            announce(t('board.sectionMoved', { name: overlay.name, target }));
            closeOverlay('deleteSection');
          }}
          onDeleteAll={() => {
            onChange(removeSection(model, overlay.name), t('board.undo.sectionAll'));
            announce(t('board.sectionAll', { name: overlay.name }));
            closeOverlay('deleteSection');
          }}
        />
      )}

      {overlay.kind === 'boardSettings' && (
        <BoardSettingsDialog
          model={model}
          announce={announce}
          onChange={onChange}
          onRequestDelete={requestStatusDelete}
          onClose={() => closeOverlay('boardSettings')}
        />
      )}

      {statusToDelete && (
        <StatusDeleteDialog
          status={statusToDelete}
          count={pendingStatusDelete!.count}
          targets={statuses.filter((st) => st !== statusToDelete)}
          onCancel={() => setPendingStatusDelete(null)}
          onConfirm={(target) => {
            const status = statusToDelete;
            const label = findStatus(statuses, target)?.label ?? target;
            onChange(
              removeStatus(model, status.key, target),
              t('board.undo.statusDeleted', { label: status.label }),
            );
            announce(t('board.statusMoved', { label: status.label, target: label }));
            setPendingStatusDelete(null);
          }}
        />
      )}

      {orphans.length > 0 && overlay.kind !== 'boardSettings' && (
        <MissingStatusDialog
          orphans={orphans}
          statuses={statuses}
          onMove={moveOrphans}
          onOpenSettings={() => openOverlay({ kind: 'boardSettings' })}
        />
      )}

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {overlay.kind === 'help' && <ShortcutHelp onClose={() => closeOverlay('help')} />}
    </section>
  );

  // ---- Renderers ----------------------------------------------------------

  function renderCard(
    task: BoardTask,
    colKey: string,
    colLabel: string,
    colVisibleIds: string[],
    visibleTasks: BoardTask[],
    dragStart: () => void,
  ) {
    return (
      <EditableTaskCard
        key={task.id}
        task={task}
        statuses={statuses}
        density={settings.density}
        showDescriptionPreview={settings.showDescriptionPreview}
        cardFields={settings.cardFields}
        dateFormat={settings.dateFormat}
        view={view}
        now={now}
        focus={focusTaskId === task.id}
        active={details?.id === task.id}
        blockedBy={openBlockers(model, task).length}
        blocking={linksOf(model, task).blocks.filter((blocked) => !isDone(blocked)).length}
        subtasks={subtaskProgress(task)}
        parentTitle={parentOf(model, task)?.title}
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
        dragging={dnd.draggingId === task.id}
        onDragEndCard={dnd.end}
      />
    );
  }

  function renderColumns(columns: LaidOutBoardColumn[]) {
    return (
      <div className={`pdt-columns ${view === 'list' ? 'pdt-columns--list' : ''}`}>
        {columns.map(({ col, collapsed, visible: visibleTasks, visibleIds }) => {
          const status = view === 'workflow' ? findStatus(statuses, col.key) : undefined;
          const isDoneCol = status?.category === 'done';
          return (
            <div
              className={`pdt-column ${collapsed ? 'pdt-column--collapsed' : ''} ${status?.bg ? 'pdt-column--tinted' : ''} ${colorMenuFor === col.key ? 'pdt-column--menu-open' : ''}`}
              style={status ? statusStyle(status) : undefined}
              key={col.key}
              {...dnd.column(col.key, (id, beforeId) => handleDrop(col, id, beforeId))}
            >
              <div className="pdt-column__head">
                <button
                  type="button"
                  className="pdt-btn pdt-btn-icon pdt-btn-sm"
                  aria-expanded={!collapsed}
                  aria-label={t(collapsed ? 'board.expandCol' : 'board.collapseCol', {
                    label: col.label,
                  })}
                  title={collapsed ? t('board.expand') : t('board.collapse')}
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
                      onChange(
                        renameSection(model, col.key, next),
                        t('board.undo.sectionRenamed', { name: next }),
                      );
                      announce(t('board.sectionRenamed', { name: next }));
                      if (viaKeyboard) setFocusSection(next);
                    }}
                    onInvalid={announce}
                  />
                ) : status ? (
                  <span className="pdt-status-name">
                    <SectionNameInput
                      name={status.label}
                      noun="status"
                      ignoreCase
                      otherNames={statuses.filter((x) => x !== status).map((x) => x.label)}
                      autoFocus={focusStatus === status.key}
                      onFocusHandled={clearFocusStatus}
                      onRename={(label) => statusActions.rename(status, label)}
                      onInvalid={announce}
                    />
                  </span>
                ) : (
                  <span className="pdt-column__name">{col.label}</span>
                )}
                <span
                  className="pdt-column__count"
                  aria-label={
                    filtersActive || hideCompleted
                      ? t('board.countShown', {
                          shown: visibleTasks.length,
                          count: col.tasks.length,
                        })
                      : t('count.tasks', { count: col.tasks.length })
                  }
                >
                  {filtersActive || hideCompleted
                    ? `${visibleTasks.length}/${col.tasks.length}`
                    : col.tasks.length}
                </span>

                {status && renderStatusOps(status)}

                {view === 'sections' && (
                  <div className="pdt-column__ops">
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon pdt-btn-sm"
                      aria-label={t('board.moveLeft', { label: col.label })}
                      title={t('board.moveLeftShort')}
                      disabled={model.sections.indexOf(col.key) === 0}
                      onClick={() => onChange(moveSection(model, col.key, -1))}
                    >
                      <Icon name="chevron-left" />
                    </button>
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon pdt-btn-sm"
                      aria-label={t('board.moveRight', { label: col.label })}
                      title={t('board.moveRightShort')}
                      disabled={model.sections.indexOf(col.key) === model.sections.length - 1}
                      onClick={() => onChange(moveSection(model, col.key, 1))}
                    >
                      <Icon name="chevron-right" />
                    </button>
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon pdt-btn-sm"
                      aria-label={t('board.useAsList', { label: col.label })}
                      aria-pressed={model.defaultSection === col.key}
                      title={t('board.showInList')}
                      onClick={() => onChange(toggleDefaultSection(model, col.key))}
                    >
                      <Icon name="checkmark-circle" />
                    </button>
                    <button
                      type="button"
                      className="pdt-btn pdt-btn-icon pdt-btn-sm"
                      aria-label={t('board.deleteSection', { label: col.label })}
                      title={t('board.deleteSectionShort')}
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
                      {dnd.dropTarget?.key === col.key && dnd.dropTarget.beforeId === task.id && (
                        <DropPlaceholder />
                      )}
                      {renderCard(task, col.key, col.label, visibleIds, visibleTasks, () =>
                        dnd.start(task.id),
                      )}
                    </Fragment>
                  ))}
                  {dnd.dropTarget?.key === col.key && dnd.dropTarget.beforeId === null && (
                    <DropPlaceholder />
                  )}

                  {visibleTasks.length === 0 && (
                    <p className="pdt-column__empty">
                      {(filtersActive || hideCompleted) && col.tasks.length > 0
                        ? t('board.noMatch')
                        : t('board.empty')}
                    </p>
                  )}
                </div>
              )}
              {!collapsed && !isDoneCol && (
                <div className="pdt-column__foot">
                  <button
                    type="button"
                    className="pdt-add-task"
                    onClick={() => openColumnQuickAdd(col)}
                  >
                    <Icon name="plus" size={14} />
                    {t('quickAdd.add')}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {view === 'workflow' && (
          <div className="pdt-column pdt-column--add">
            <button
              type="button"
              className="pdt-add-column"
              onClick={() => setFocusStatus(statusActions.add())}
            >
              <Icon name="plus" size={14} />
              {t('settings.add')}
            </button>
          </div>
        )}

        {view === 'sections' && (
          <div className="pdt-column pdt-column--add">
            <button
              type="button"
              className="pdt-add-column"
              onClick={() => {
                onChange(addSection(model));
                announce(t('board.sectionAdded'));
              }}
            >
              <Icon name="plus" size={14} />
              {t('board.addSection')}
            </button>
          </div>
        )}
      </div>
    );
  }

  /** Workflow column controls: reorder, colours and delete, like a section's. */
  function renderStatusOps(status: StatusDef) {
    const index = statuses.indexOf(status);
    return (
      <div className="pdt-column__ops">
        <button
          type="button"
          className="pdt-btn pdt-btn-icon pdt-btn-sm"
          aria-label={t('board.moveLeft', { label: status.label })}
          title={t('board.moveLeftShort')}
          disabled={index === 0}
          onClick={() => statusActions.move(status, -1)}
        >
          <Icon name="chevron-left" />
        </button>
        <button
          type="button"
          className="pdt-btn pdt-btn-icon pdt-btn-sm"
          aria-label={t('board.moveRight', { label: status.label })}
          title={t('board.moveRightShort')}
          disabled={index === statuses.length - 1}
          onClick={() => statusActions.move(status, 1)}
        >
          <Icon name="chevron-right" />
        </button>
        <div className="pdt-colorpicker" ref={colorMenuFor === status.key ? colorMenuRef : null}>
          <button
            type="button"
            className="pdt-btn pdt-btn-icon pdt-btn-sm"
            aria-label={t('board.colors', { label: status.label })}
            aria-haspopup="dialog"
            aria-expanded={colorMenuFor === status.key}
            title={t('board.colorsShort')}
            onClick={() => setColorMenuFor((k) => (k === status.key ? null : status.key))}
          >
            <Icon name="palette" />
          </button>
          {colorMenuFor === status.key && (
            <div
              className="pdt-colorpicker__panel pdt-colorpicker__panel--end"
              role="dialog"
              aria-label={t('board.colors', { label: status.label })}
            >
              <span className="pdt-field-label">{t('settings.text')}</span>
              <ColorSwatches
                label={t('board.textColor')}
                role="text"
                value={status.color}
                onChange={(color) => setStatusColors(status, { color, bg: status.bg })}
              />
              <span className="pdt-field-label">{t('settings.background')}</span>
              <ColorSwatches
                label={t('board.bgColor')}
                role="bg"
                value={status.bg}
                onChange={(bg) => setStatusColors(status, { color: status.color, bg })}
              />
              <button
                type="button"
                className="pdt-link"
                onClick={() => {
                  setColorMenuFor(null);
                  openOverlay({ kind: 'boardSettings' });
                }}
              >
                {t('board.allSettings')}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          className="pdt-btn pdt-btn-icon pdt-btn-sm"
          aria-label={t('settings.delete', { label: status.label })}
          title={statusActions.removeHint(status)}
          disabled={!statusActions.canRemove(status)}
          onClick={() => requestStatusDelete(status.key)}
        >
          <Icon name="trash" />
        </button>
      </div>
    );
  }

  function renderSwimlane() {
    return (
      <div className="pdt-swimlane" role="table" aria-label={t('board.swimlane')}>
        <div
          className="pdt-swimlane__head"
          role="row"
          style={{ '--pdt-swimlane-cols': statuses.length }}
        >
          <div className="pdt-swimlane__corner" role="columnheader">
            {t('quickAdd.section')}
          </div>
          {statuses.map((c) => (
            <div
              key={c.key}
              className="pdt-swimlane__colhead"
              role="columnheader"
              style={statusStyle(c)}
            >
              <span className="pdt-status-pill">{c.label}</span>
            </div>
          ))}
        </div>

        {layout.rows.map(({ section, collapsed: rowCollapsed, count: rowCount, cells }) => {
          return (
            <div
              key={section}
              className="pdt-swimlane__row"
              role="row"
              style={{ '--pdt-swimlane-cols': statuses.length }}
            >
              <div className="pdt-swimlane__rowhead" role="rowheader">
                <button
                  type="button"
                  className="pdt-btn pdt-btn-icon"
                  aria-expanded={!rowCollapsed}
                  aria-label={t(rowCollapsed ? 'board.expandCol' : 'board.collapseCol', {
                    label: section,
                  })}
                  onClick={() => onToggleRowCollapse(section)}
                >
                  <Icon name={rowCollapsed ? 'chevron-right' : 'chevron-down'} />
                </button>
                <span className="pdt-swimlane__rowname">{section}</span>
                <span className="pdt-column__count">{rowCount}</span>
              </div>

              {rowCollapsed
                ? null
                : cells.map(({ status: c, cell }) => {
                    const { col: cellCol, visible: visibleTasks, visibleIds } = cell;
                    return (
                      <div
                        key={c.key}
                        className={`pdt-swimlane__cell ${c.bg ? 'pdt-swimlane__cell--tinted' : ''}`}
                        style={statusStyle(c)}
                        role="cell"
                        {...dnd.cell(cellCol.key, (id) => handleSwimlaneDrop(section, c.key, id))}
                      >
                        {visibleTasks.map((task) =>
                          renderCard(
                            task,
                            cellCol.key,
                            cellCol.label,
                            visibleIds,
                            visibleTasks,
                            () => dnd.start(task.id),
                          ),
                        )}
                        {dnd.dropTarget?.key === cellCol.key && <DropPlaceholder />}
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
function bulkActionLabel(t: TFunction, action: BulkAction, count: number): string {
  const n = t('count.tasks', { count });
  switch (action.kind) {
    case 'complete':
      return t('bulkLabel.complete', { n });
    case 'status':
      return t('bulkLabel.status', { n });
    case 'section':
      return t('bulkLabel.section', { n, section: action.section });
    case 'priority':
      return t('bulkLabel.priority', { n });
    case 'assignee':
      return t('bulkLabel.assignee', { n });
    case 'due':
      return t('bulkLabel.due', { n });
    case 'addLabel':
      return t('bulkLabel.addLabel', { n, label: action.label });
    case 'removeLabel':
      return t('bulkLabel.removeLabel', { n, label: action.label });
    case 'delete':
      return t('bulkLabel.delete', { n });
  }
}

interface BuildCommandsArgs {
  filtersActive: boolean;
  saveState: SaveState;
  hideCompleted: boolean;
  doneCollapsed: boolean;
  addTask: () => void;
  focusSearch: () => void;
  cycleView: () => void;
  clearFilters: () => void;
  openSort: () => void;
  toggleHideCompleted: () => void;
  toggleDoneCollapsed: () => void;
  openBoardSettings: () => void;
  openSettings: () => void;
  back: () => void;
  openHelp: () => void;
  retry: () => void;
}

function buildCommands(t: TFunction, a: BuildCommandsArgs): Command[] {
  return [
    { id: 'add', title: t('quickAdd.add'), hint: 'N', run: a.addTask },
    { id: 'search', title: t('board.search'), hint: '/', keywords: 'find', run: a.focusSearch },
    {
      id: 'view',
      title: t('commands.switchView'),
      hint: 'V',
      keywords: 'workflow sections swimlane list',
      run: a.cycleView,
    },
    {
      id: 'clear',
      title: t('board.clearFilters'),
      keywords: 'reset',
      disabled: !a.filtersActive,
      disabledReason: t('commands.noFilters'),
      run: a.clearFilters,
    },
    { id: 'sort', title: t('commands.sorting'), hint: 'S', run: a.openSort },
    {
      id: 'completed',
      title: a.hideCompleted ? t('commands.showCompleted') : t('commands.hideCompleted'),
      keywords: 'done',
      run: a.toggleHideCompleted,
    },
    {
      id: 'collapse-done',
      title: a.doneCollapsed ? t('commands.expandDone') : t('commands.collapseDone'),
      run: a.toggleDoneCollapsed,
    },
    {
      id: 'board-settings',
      title: t('settings.title'),
      keywords: t('commands.settingsKeywords'),
      run: a.openBoardSettings,
    },
    { id: 'settings', title: t('commands.openSettings'), run: a.openSettings },
    { id: 'back', title: t('board.back'), run: a.back },
    { id: 'shortcuts', title: t('commands.shortcuts'), hint: '?', run: a.openHelp },
    {
      id: 'retry',
      title: t('commands.retry'),
      disabled: a.saveState !== 'error',
      disabledReason: t('commands.saved'),
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
  const { t } = useTranslation();
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <span className="pdt-progress" title={t('board.percent', { pct })}>
      <span
        className="pdt-progress__bar"
        role="progressbar"
        aria-label={t('board.completedAria')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span className="pdt-progress__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="pdt-progress__text">{t('board.progress', { done, total })}</span>
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
  const { t } = useTranslation();
  if (state === 'error') {
    return (
      <span className="pdt-save pdt-save--error" role="status">
        <Icon name="exclamation-circle" size={14} /> {t('board.saveFailed')}
        <button type="button" className="pdt-link" onClick={onRetry}>
          {t('board.retry')}
        </button>
      </span>
    );
  }
  if (state === 'paused') {
    return (
      <span className="pdt-save pdt-save--warning" role="status" title={t('board.pausedTitle')}>
        <Icon name="exclamation-circle" size={14} /> {t('board.waiting')}
      </span>
    );
  }
  return null;
}

interface SectionDeleteDialogProps {
  info: { name: string; count: number };
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
  const { t } = useTranslation();
  const [target, setTarget] = useState(sections[0] ?? '');
  return (
    <Dialog title={t('sectionDialog.title', { name: info.name })} onClose={onCancel}>
      <p className="pdt-modal__text">
        {t('sectionDialog.text', { name: info.name, count: info.count })}
      </p>

      {sections.length > 0 && (
        <div className="pdt-modal__choice">
          <label className="pdt-field pdt-field--grow">
            <span className="pdt-field-label">{t('statusDialog.moveTo')}</span>
            <select
              className="pdt-select"
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
            {t('sectionDialog.move')}
          </button>
        </div>
      )}

      <div className="pdt-modal__actions">
        <button className="pdt-btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button className="pdt-btn pdt-btn-danger" onClick={onDeleteAll}>
          {t('sectionDialog.deleteAll')}
        </button>
      </div>
    </Dialog>
  );
}
