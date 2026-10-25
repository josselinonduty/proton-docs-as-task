/** Projections of the model into the board's views. */

import type { BoardView } from '@/lib/types';
import type { BoardColumn, BoardModel, BoardTask } from './types';

/** Project the model into the columns for a given view. Empty columns kept. */
export function columnsForView(model: BoardModel, view: BoardView): BoardColumn[] {
  if (view === 'list') {
    const rank = (t: BoardTask) => model.sections.indexOf(t.section);
    const { defaultSection } = model;
    const tasks = defaultSection
      ? model.tasks.filter((t) => t.section === defaultSection)
      : model.tasks;
    return [
      {
        key: 'list',
        label: defaultSection ?? 'Tasks',
        tasks: tasks.toSorted((a, b) => rank(a) - rank(b)),
      },
    ];
  }
  if (view === 'workflow') {
    return model.statuses.map((col) => ({
      key: col.key,
      label: col.label,
      status: col.key,
      tasks: model.tasks.filter((t) => t.status === col.key),
    }));
  }
  return model.sections.map((name) => ({
    key: name,
    label: name,
    section: name,
    tasks: model.tasks.filter((t) => t.section === name),
  }));
}
