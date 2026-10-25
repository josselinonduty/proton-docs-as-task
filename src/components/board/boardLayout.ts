import {
  columnsForView,
  isTaskDone,
  type BoardColumn,
  type BoardModel,
  type BoardTask,
} from '../../lib/model';
import { hasActiveFilters, matchesFilters, type FilterState } from '../../lib/filters';
import { isActiveSort, sortTasks, type SortState } from '../../lib/sorting';
import type { BoardView, StatusDef } from '../../lib/types';

/** What decides which cards the board shows, and where. */
export interface LayoutInput {
  model: BoardModel;
  view: BoardView;
  filters: FilterState;
  sort: SortState;
  hideCompleted: boolean;
  now: Date;
  collapsedColumns: string[];
  collapsedRows: string[];
}

/** A column, or a swimlane cell, with the cards it shows. */
export interface LaidOutColumn {
  col: BoardColumn;
  /** Shown cards in display order: sorted, then narrowed by filters and Hide completed. */
  visible: BoardTask[];
  visibleIds: string[];
  /** The place each shown card has in it. */
  place: CardPlace;
}

export interface LaidOutBoardColumn extends LaidOutColumn {
  collapsed: boolean;
}

export interface SwimlaneRow {
  section: string;
  collapsed: boolean;
  /** Every task in the section, shown or not. */
  count: number;
  /** One cell per status; none while the row is collapsed. */
  cells: { status: StatusDef; cell: LaidOutColumn }[];
}

/** Where a shown card sits: its column's shown cards, for moves, ranges and "n of m". */
export interface CardPlace {
  colKey: string;
  colLabel: string;
  ids: string[];
  tasks: BoardTask[];
}

export interface BoardLayout {
  /** Workflow, Sections and List columns, left to right (empty in Swimlane). */
  columns: LaidOutBoardColumn[];
  /** Swimlane rows, one per section (empty in the other views). */
  rows: SwimlaneRow[];
  /** Cards on screen in reading order, for J / K. Collapsed ones aren't. */
  navOrder: string[];
  places: Map<string, CardPlace>;
}

type VisibilityInput = Pick<LayoutInput, 'model' | 'filters' | 'hideCompleted' | 'now'>;

/** True when filters and Hide completed let `task` through. */
export function isTaskShown(task: BoardTask, input: VisibilityInput): boolean {
  const { model, filters, hideCompleted, now } = input;
  const isDone = (candidate: BoardTask) => isTaskDone(model, candidate);
  return (
    (!hasActiveFilters(filters) || matchesFilters(task, filters, now, isDone)) &&
    !(hideCompleted && isDone(task))
  );
}

/**
 * Lay the board out for `view`: the columns or swimlane rows and the cards
 * each shows, plus the keyboard order and per-card place the rest of the
 * board reads. Pure, so the board computes it once per change, not while
 * rendering each card.
 */
export function layoutBoard(input: LayoutInput): BoardLayout {
  const { model, view, sort, collapsedColumns, collapsedRows } = input;
  const sortActive = isActiveSort(sort);
  const navOrder: string[] = [];
  const places = new Map<string, CardPlace>();

  const layOut = (col: BoardColumn, onScreen: boolean): LaidOutColumn => {
    const ordered = sortActive ? sortTasks(col.tasks, sort) : col.tasks;
    const visible = ordered.filter((task) => isTaskShown(task, input));
    const visibleIds = visible.map((task) => task.id);
    const place = { colKey: col.key, colLabel: col.label, ids: visibleIds, tasks: visible };
    if (onScreen) {
      for (const id of visibleIds) {
        navOrder.push(id);
        places.set(id, place);
      }
    }
    return { col, visible, visibleIds, place };
  };

  if (view !== 'swimlane') {
    const columns = columnsForView(model, view).map((col) => {
      const collapsed = collapsedColumns.includes(col.key);
      return { ...layOut(col, !collapsed), collapsed };
    });
    return { columns, rows: [], navOrder, places };
  }

  const rows = model.sections.map((section): SwimlaneRow => {
    const collapsed = collapsedRows.includes(section);
    const count = model.tasks.filter((task) => task.section === section).length;
    const cells = collapsed
      ? []
      : model.statuses.map((status) => ({
          status,
          cell: layOut(
            {
              key: `${section}::${status.key}`,
              label: `${section} / ${status.label}`,
              status: status.key,
              section,
              tasks: model.tasks.filter(
                (task) => task.section === section && task.status === status.key,
              ),
            },
            true,
          ),
        }));
    return { section, collapsed, count, cells };
  });
  return { columns: [], rows, navOrder, places };
}
