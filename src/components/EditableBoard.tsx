import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addTask,
  applyBulkAction,
  columnsForView,
  countTasks,
  isTaskDone,
  orphanStatuses,
  removeSection,
  removeStatus,
  removeTask,
  serializeModel,
  updateStatus,
  updateTask,
  type BulkAction,
  type BoardColumn,
  type BoardModel,
  type BoardTask,
} from '@/lib/model';
import {
  buildPresets,
  collectFacets,
  hasActiveFilters,
  matchesFilters,
  EMPTY_FILTERS,
  type FilterState,
} from '@/lib/filters';
import { applySortToModel, isActiveSort, MANUAL_SORT, type SortState } from '@/lib/sorting';
import { findStatus } from '@/lib/statuses';
import { buildAssigneeIndex, buildLabelIndex } from '@/lib/suggestions';
import {
  BOARD_VIEWS,
  type BoardView,
  type SaveState,
  type Settings,
  type StatusDef,
  type StatusKey,
} from '@/lib/types';
import { QuickAddForm, type QuickAddPayload } from './QuickAddForm';
import { BulkBar } from './BulkBar';
import { CommandPalette } from './CommandPalette';
import { ShortcutHelp } from './ShortcutHelp';
import { Dialog } from './Dialog';
import { useDismiss } from './useDismiss';
import { useStatusActions } from './useStatusActions';
import { BoardContext, type BoardContextValue } from './board/BoardContext';
import { BoardHeader } from './board/BoardHeader';
import { BoardColumns } from './board/BoardColumns';
import { BoardSwimlane } from './board/BoardSwimlane';
import { BoardDetails } from './board/BoardDetails';
import { BoardConfirmDialogs, type PendingStatusDelete } from './board/BoardConfirmDialogs';
import { isTaskShown, layoutBoard } from './board/boardLayout';
import { bulkActionLabel } from './board/bulkActionLabel';
import { useNow } from './board/useNow';
import { useBoardOverlay } from './board/useBoardOverlay';
import { useBoardSelection } from './board/useBoardSelection';
import { useDetailsNavigation } from './board/useDetailsNavigation';
import { useBoardDnd } from './board/useBoardDnd';
import { useBoardShortcuts } from './board/useBoardShortcuts';
import { useBoardCommands } from './board/useBoardCommands';
import { useTaskActions } from './board/useTaskActions';

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

/**
 * The open board: header, the current view's columns or swimlane, the details
 * panel, bulk bar and dialogs. It owns the board's UI state and actions; the
 * pieces live in `./board/` and read what they share from `BoardContext`.
 */
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
    onUndo,
    onRetry,
    onOpenSettings,
    onClose,
  } = props;

  const { t } = useTranslation();
  const { statuses } = model;
  const statusActions = useStatusActions({ model, onChange, announce });
  const now = useNow();
  const filtersActive = hasActiveFilters(filters);
  const sortActive = isActiveSort(sort);
  const hideCompleted = settings.completedDisplay === 'hide';

  const facets = useMemo(() => collectFacets(model), [model]);
  const orphans = useMemo(() => orphanStatuses(model), [model]);
  const progress = useMemo(() => countTasks(model), [model]);
  const assigneeSuggestions = useMemo(() => buildAssigneeIndex(model), [model]);
  const labelSuggestions = useMemo(() => buildLabelIndex(model), [model]);
  const presets = useMemo(
    () => buildPresets({ userAssignee: settings.userAssignee, canUseCreated: true }),
    [settings.userAssignee],
  );
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

  // ---- Local UI state -----------------------------------------------------
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [hiddenNotice, setHiddenNotice] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const {
    overlay,
    open: openOverlay,
    close: closeOverlay,
    isOpen: overlayOpen,
  } = useBoardOverlay();
  // Outside the overlay union, since each stacks on top of an open overlay.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingStatusDelete, setPendingStatusDelete] = useState<PendingStatusDelete | null>(null);
  // Popovers: they don't block shortcuts, and Escape closes them.
  const [sortOpen, setSortOpen] = useState(false);
  const [colorMenuFor, setColorMenuFor] = useState<StatusKey | null>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const selection = useBoardSelection();
  const { selectionMode, selected } = selection;
  const detailsNav = useDetailsNavigation(model.tasks);
  const { details } = detailsNav;
  const dnd = useBoardDnd();

  const boardRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the board once it opens so keyboard shortcuts fire immediately.
  // Without this, focus stays outside the shadow root (on the page body) and
  // key events never reach the board's onKeyDown handler.
  useEffect(() => {
    boardRef.current?.focus();
  }, []);

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

  const tasks = useTaskActions({
    model,
    view,
    sortActive,
    onChange,
    announce,
    onBlocked: setBlockedNotice,
    focusTask: setFocusTaskId,
  });

  // ---- Deleting cards -----------------------------------------------------
  const requestDelete = (task: BoardTask) => {
    if (settings.confirmDelete) openOverlay({ kind: 'deleteCard', task });
    else confirmDeleteCard(task);
  };

  const confirmDeleteCard = (task: BoardTask) => {
    onChange(removeTask(model, task.id), t('board.undo.deleted'));
    announce(t('board.deleted', { title: tasks.taskName(task) }));
    closeOverlay('deleteCard');
    // The card (and maybe the details panel) is gone; keep keyboard focus on the board.
    if (details?.id === task.id) detailsNav.close();
    requestAnimationFrame(() => boardRef.current?.focus());
  };

  // ---- Quick add ----------------------------------------------------------
  const openQuickAdd = () => openOverlay({ kind: 'quickAdd', preset: null });

  /** From a column footer: preselect that column's section or status. */
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

  const submitQuickAdd = (payload: QuickAddPayload) => {
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
    props.onQuickAddSectionChange(payload.section);
    setFocusTaskId(taskId);
    setHighlightId(taskId);
    announce(t('board.added', { title: payload.title }));

    const created = next.tasks.find((task) => task.id === taskId);
    const hiddenByFilters = created
      ? filtersActive && !matchesFilters(created, filters, now, tasks.isDone)
      : false;
    setHiddenNotice(hiddenByFilters);
  };

  // ---- Selection and bulk actions -----------------------------------------
  const runBulk = (action: BulkAction) => {
    const ids = [...selected].filter((id) => model.tasks.some((task) => task.id === id));
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

  /** Select every card filters and Hide completed let through, collapsed columns included. */
  const selectAllVisible = () => {
    const ids = new Set<string>();
    for (const task of model.tasks) {
      if (isTaskShown(task, { model, filters, hideCompleted, now })) ids.add(task.id);
    }
    selection.select(ids);
    announce(t('board.selectedCount', { count: ids.size }));
  };

  const toggleSelect = (task: BoardTask, colKey: string, colIds: string[], shift: boolean) =>
    selection.toggle(task.id, colKey, colIds, shift);

  // ---- Sections and statuses ----------------------------------------------
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

  const doneKeys = statuses.filter((s) => s.category === 'done').map((s) => s.key);
  const doneCollapsed = doneKeys.length > 0 && doneKeys.every((k) => collapsedColumns.includes(k));
  const toggleDoneCollapsed = () => {
    for (const key of doneKeys) {
      if (collapsedColumns.includes(key) === doneCollapsed) onToggleColumnCollapse(key);
    }
  };

  // ---- Board-wide actions -------------------------------------------------
  const copyBoardMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(serializeModel(model, marker));
      announce(t('board.boardCopied'));
    } catch {
      announce(t('board.copyFailed'));
    }
  };

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

  const openBoardSettings = () => openOverlay({ kind: 'boardSettings' });
  const openHelp = () => openOverlay({ kind: 'help' });
  const focusSearch = () => searchRef.current?.focus();

  // ---- Keyboard -----------------------------------------------------------
  const focusCardAt = (delta: number) => {
    const order = layout.navOrder;
    if (order.length === 0) return;
    const current = focusedCardId ? order.indexOf(focusedCardId) : -1;
    const nextIdx = Math.max(0, Math.min(order.length - 1, current + delta));
    const id = current < 0 ? order[0]! : order[nextIdx]!;
    setFocusTaskId(id);
    setFocusedCardId(id);
  };

  const closeDetails = () => {
    const id = detailsNav.close();
    if (id) setFocusTaskId(id);
  };

  const handleKeyDown = useBoardShortcuts({
    overlayOpen: overlayOpen || paletteOpen || pendingStatusDelete != null || orphans.length > 0,
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
      exitSelection: selection.exit,
      undo: onUndo,
      selectAll: selectAllVisible,
      addTask: openQuickAdd,
      focusSearch,
      openFilters: () => filterBtnRef.current?.click(),
      cycleView,
      toggleSort: () => setSortOpen((v) => !v),
      focusCard: focusCardAt,
      openDetails: detailsNav.open,
      toggleDone: tasks.toggleDone,
      toggleSelect: (task) => {
        const place = layout.places.get(task.id);
        if (place) toggleSelect(task, place.colKey, place.ids, false);
      },
      requestBulkDelete: () => openOverlay({ kind: 'deleteBulk' }),
      requestDelete,
      openHelp,
    },
  });

  const commands = useBoardCommands({
    filtersActive,
    saveState,
    hideCompleted,
    doneCollapsed,
    addTask: openQuickAdd,
    focusSearch,
    cycleView,
    clearFilters: () => onFiltersChange({ ...EMPTY_FILTERS }),
    openSort: () => setSortOpen(true),
    toggleHideCompleted: () =>
      onSettingsChange({ completedDisplay: hideCompleted ? 'show' : 'hide' }),
    toggleDoneCollapsed,
    openBoardSettings,
    openSettings: onOpenSettings,
    back: onClose,
    openHelp,
    retry: onRetry,
  });

  const board: BoardContextValue = {
    model,
    view,
    settings,
    now,
    sortActive,
    narrowed: filtersActive || hideCompleted,
    onChange,
    announce,
    tasks,
    focusTaskId,
    activeTaskId: details?.id ?? null,
    highlightId,
    selected: selectionMode ? selected : null,
    toggleSelect,
    cardFocused: setFocusedCardId,
    focusHandled: () => setFocusTaskId(null),
    openDetails: detailsNav.open,
    requestDelete,
    dnd,
    toggleColumnCollapse: onToggleColumnCollapse,
    toggleRowCollapse: props.onToggleRowCollapse,
    openColumnQuickAdd,
    requestSectionDelete,
    statusActions,
    requestStatusDelete,
    setStatusColors,
    colorMenuFor,
    colorMenuRef,
    setColorMenuFor,
    openBoardSettings,
  };

  const detailsTask = details ? model.tasks.find((task) => task.id === details.id) : undefined;

  return (
    <BoardContext value={board}>
      <section
        className={`pdt-board ${selectionMode ? 'pdt-board--selecting' : ''}`}
        role="region"
        aria-label={t('board.region')}
        tabIndex={-1}
        ref={boardRef}
        onKeyDown={handleKeyDown}
      >
        <BoardHeader
          title={model.title}
          progress={progress}
          saveState={saveState}
          view={view}
          filters={filters}
          facets={facets}
          presets={presets}
          statuses={statuses}
          sort={sort}
          sortOpen={sortOpen}
          searchRef={searchRef}
          filterBtnRef={filterBtnRef}
          menu={{
            selectionMode,
            onToggleSelection: selectionMode ? selection.exit : selection.start,
            onBoardSettings: openBoardSettings,
            onCopyBoard: copyBoardMarkdown,
            onReload: props.onReloadFromDoc,
            onPalette: () => setPaletteOpen(true),
            onHelp: openHelp,
            onExtensionSettings: onOpenSettings,
          }}
          announce={announce}
          onClose={onClose}
          onRetry={onRetry}
          onAddTask={openQuickAdd}
          onViewChange={onViewChange}
          onFiltersChange={onFiltersChange}
          onSortOpenChange={setSortOpen}
          onSortChange={onSortChange}
          onApplySortToDocument={applySortToDocument}
          onOpenSettings={onOpenSettings}
        />

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
              onSubmit={submitQuickAdd}
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
            {view === 'swimlane' ? (
              <BoardSwimlane rows={layout.rows} />
            ) : (
              <BoardColumns columns={layout.columns} />
            )}
          </div>
          {detailsTask && details && (
            <BoardDetails
              task={detailsTask}
              target={details}
              place={layout.places.get(detailsTask.id)}
              assigneeSuggestions={assigneeSuggestions}
              labelSuggestions={labelSuggestions}
              onBack={detailsNav.canGoBack ? detailsNav.goBack : undefined}
              onOpenLinked={detailsNav.openLinked}
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
            onExit={selection.exit}
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

        <BoardConfirmDialogs
          overlay={overlay}
          closeOverlay={closeOverlay}
          openBoardSettings={openBoardSettings}
          pendingStatusDelete={pendingStatusDelete}
          onStatusDeleteDone={() => setPendingStatusDelete(null)}
          orphans={orphans}
          selectedCount={selected.size}
          onDeleteCard={confirmDeleteCard}
          onDeleteSelected={() => runBulk({ kind: 'delete' })}
          onRequestStatusDelete={requestStatusDelete}
        />

        {paletteOpen && (
          <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />
        )}
        {overlay.kind === 'help' && <ShortcutHelp onClose={() => closeOverlay('help')} />}
      </section>
    </BoardContext>
  );
}
