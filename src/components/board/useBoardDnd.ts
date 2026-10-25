import { useRef, useState, type DragEvent } from 'react';

/** Where a dragged card would land: a column (or cell) and the card it goes before. */
export interface DropTarget {
  key: string;
  beforeId: string | null;
}

/**
 * Card drag and drop: which card is dragged, where it would drop, and the
 * handlers columns and swimlane cells attach. The board decides what a drop
 * does.
 */
export function useBoardDnd() {
  const draggedId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const end = () => {
    draggedId.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  // Hiding the source synchronously in dragstart makes browsers cancel the drag.
  const start = (id: string) => {
    draggedId.current = id;
    setTimeout(() => draggedId.current === id && setDraggingId(id));
  };

  /** Only update on change so hovering does not re-render on every dragover. */
  const hover = (key: string, beforeId: string | null) =>
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

  const onDragLeave = (e: DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
  };

  /** A column drops between cards, before the one under the pointer. */
  const column = (key: string, onDrop: (id: string, beforeId: string | null) => void) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      if (draggedId.current) hover(key, cardBefore(e.currentTarget, e.clientY));
    },
    onDragLeave,
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      const id = draggedId.current;
      const beforeId = dropTarget?.key === key ? dropTarget.beforeId : null;
      end();
      if (id) onDrop(id, beforeId);
    },
  });

  /** A swimlane cell takes the card at its end. */
  const cell = (key: string, onDrop: (id: string) => void) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      if (draggedId.current) hover(key, null);
    },
    onDragLeave,
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      const id = draggedId.current;
      end();
      if (id) onDrop(id);
    },
  });

  return { draggingId, dropTarget, start, end, column, cell };
}

export type BoardDnd = ReturnType<typeof useBoardDnd>;
