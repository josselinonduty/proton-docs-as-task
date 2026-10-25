import {
  createContext,
  useContext,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { BoardColumn, BoardModel, BoardTask } from '../../lib/model';
import type { BoardView, Settings, StatusDef, StatusKey } from '../../lib/types';
import type { useStatusActions } from '../useStatusActions';
import type { DetailsFocus } from '../TaskDetailsPanel';
import type { BoardDnd } from './useBoardDnd';
import type { TaskActions } from './useTaskActions';

/**
 * What the board's columns, swimlane, cards and details panel share: the
 * board as shown and the actions they call. `EditableBoard` provides a fresh
 * value each render, so nothing here needs to be stable.
 */
export interface BoardContextValue {
  model: BoardModel;
  view: BoardView;
  settings: Settings;
  now: Date;
  /** A sort is active: manual reordering and drag and drop are off. */
  sortActive: boolean;
  /** Filters or Hide completed narrow the cards shown, so counts read "shown/total". */
  narrowed: boolean;
  onChange: (next: BoardModel, undoLabel?: string) => void;
  announce: (message: string) => void;

  // Cards
  tasks: TaskActions;
  /** Card asked to take focus (after a move, or J / K). */
  focusTaskId: string | null;
  /** Card open in the details panel. */
  activeTaskId: string | null;
  /** Just-added card, flashed briefly. */
  highlightId: string | null;
  /** Selection mode's selected cards, or null outside it. */
  selected: Set<string> | null;
  toggleSelect: (task: BoardTask, colKey: string, colIds: string[], shift: boolean) => void;
  cardFocused: (id: string) => void;
  focusHandled: () => void;
  openDetails: (id: string, focus?: DetailsFocus) => void;
  requestDelete: (task: BoardTask) => void;
  dnd: BoardDnd;

  // Columns and rows
  toggleColumnCollapse: (key: string) => void;
  toggleRowCollapse: (key: string) => void;
  openColumnQuickAdd: (col: BoardColumn) => void;
  requestSectionDelete: (name: string) => void;
  statusActions: ReturnType<typeof useStatusActions>;
  requestStatusDelete: (key: StatusKey) => void;
  setStatusColors: (status: StatusDef, patch: Pick<StatusDef, 'color' | 'bg'>) => void;
  /** The status whose colour popover is open, and its element (for outside clicks). */
  colorMenuFor: StatusKey | null;
  colorMenuRef: RefObject<HTMLDivElement | null>;
  setColorMenuFor: Dispatch<SetStateAction<StatusKey | null>>;
  openBoardSettings: () => void;
}

export const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoard(): BoardContextValue {
  const value = useContext(BoardContext);
  if (!value) throw new Error('useBoard() outside <BoardContext>');
  return value;
}
