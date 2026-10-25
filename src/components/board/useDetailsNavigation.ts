import { useState } from 'react';
import type { BoardTask } from '../../lib/model';
import type { DetailsFocus } from '../TaskDetailsPanel';

/** The task in the details panel, what to focus there, and a nonce to re-request focus. */
export interface DetailsTarget {
  id: string;
  focus: DetailsFocus;
  nonce: number;
}

/**
 * The details panel's task and the trail of linked tasks followed to reach
 * it, so Back can retrace them.
 */
export function useDetailsNavigation(tasks: BoardTask[]) {
  const [details, setDetails] = useState<DetailsTarget | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const exists = (id: string) => tasks.some((task) => task.id === id);

  // The task shown was deleted (here or elsewhere): close the panel.
  if (details && !exists(details.id)) setDetails(null);

  const show = (id: string, focus: DetailsFocus) =>
    setDetails((d) => ({ id, focus, nonce: (d?.nonce ?? 0) + 1 }));

  /** Open `id` fresh, forgetting the trail. */
  const open = (id: string, focus: DetailsFocus = 'panel') => {
    setTrail([]);
    show(id, focus);
  };

  /** Follow a link: open the task in the panel, remembering where we came from. */
  const openLinked = (id: string) => {
    if (details) setTrail((prev) => [...prev, details.id]);
    show(id, 'panel');
  };

  /** Return to the last task on the trail that still exists. */
  const goBack = () => {
    const rest = trail.filter(exists);
    const id = rest.pop();
    setTrail(rest);
    if (id) show(id, 'panel');
  };

  /** Close the panel; returns the task it showed, if any. */
  const close = (): string | null => {
    setDetails(null);
    return details?.id ?? null;
  };

  return { details, canGoBack: trail.length > 0, open, openLinked, goBack, close };
}
