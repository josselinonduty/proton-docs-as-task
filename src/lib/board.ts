import type { ColumnDef, ParseResult, StatusKey, Task } from './types';

export interface BoardGroup {
  key: string;
  label: string;
  tasks: Task[];
}

/** Group tasks into the configured status columns (empty columns kept). */
export function groupByStatus(tasks: Task[], columns: ColumnDef[]): BoardGroup[] {
  const byStatus = new Map<StatusKey, Task[]>();
  for (const col of columns) byStatus.set(col.key, []);
  const fallbackKey = columns[0]?.key;
  for (const task of tasks) {
    // Fall back to the first column if a status has no matching column.
    const bucket =
      byStatus.get(task.status) ?? (fallbackKey ? byStatus.get(fallbackKey) : undefined);
    bucket?.push(task);
  }
  return columns.map((col) => ({
    key: col.key,
    label: col.label,
    tasks: byStatus.get(col.key) ?? [],
  }));
}

/** Group tasks by their document section, preserving first-seen order. */
export function groupBySection(tasks: Task[], sections: string[]): BoardGroup[] {
  const order = sections.length > 0 ? sections : ['Tasks'];
  const bySection = new Map<string, Task[]>();
  for (const name of order) bySection.set(name, []);
  for (const task of tasks) {
    if (!bySection.has(task.section)) bySection.set(task.section, []);
    bySection.get(task.section)!.push(task);
  }
  return Array.from(bySection.entries()).map(([key, list]) => ({
    key,
    label: key,
    tasks: list,
  }));
}

export interface BoardSummary {
  total: number;
  done: number;
  /** Completion ratio in the range [0, 1]. */
  progress: number;
}

export function summarize(result: ParseResult): BoardSummary {
  const total = result.tasks.length;
  const done = result.tasks.filter((t) => t.status === 'done').length;
  return {
    total,
    done,
    progress: total === 0 ? 0 : done / total,
  };
}
