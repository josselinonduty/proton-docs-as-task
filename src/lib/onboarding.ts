import { DEFAULT_CARD_FIELDS } from './defaults';
import type { BoardView, Settings, StatusFlow } from './types';

/**
 * The starting layouts the welcome page offers. Each one only bundles the
 * settings that shape how the board looks; everything else keeps its default,
 * and every setting stays individually editable on the options page.
 */
export const LAYOUTS = ['list', 'board', 'swimlanes'] as const;
export type Layout = (typeof LAYOUTS)[number];

/** Matches {@link DEFAULT_SETTINGS}, so skipping the welcome page changes nothing. */
export const DEFAULT_LAYOUT: Layout = 'board';

type LayoutSettings = Pick<Settings, 'defaultView' | 'density' | 'cardFields'>;

export const LAYOUT_PRESETS: Record<Layout, LayoutSettings> = {
  // A tidy checklist: just the title and the due date.
  list: {
    defaultView: 'list',
    density: 'compact',
    cardFields: {
      ...DEFAULT_CARD_FIELDS,
      description: false,
      priority: false,
      assignee: false,
      labels: false,
    },
  },
  board: {
    defaultView: 'workflow',
    density: 'comfortable',
    cardFields: { ...DEFAULT_CARD_FIELDS },
  },
  swimlanes: {
    defaultView: 'swimlane',
    density: 'compact',
    cardFields: { ...DEFAULT_CARD_FIELDS },
  },
};

/** The settings to persist for the choices made on the welcome page. */
export function onboardingPatch(layout: Layout, flow: StatusFlow): Partial<Settings> {
  const { cardFields, ...rest } = LAYOUT_PRESETS[layout];
  return { ...rest, cardFields: { ...cardFields }, defaultStatuses: flow };
}

/** The layout closest to a stored view, to preselect when setup is run again. */
export function layoutForView(view: BoardView): Layout {
  return LAYOUTS.find((layout) => LAYOUT_PRESETS[layout].defaultView === view) ?? DEFAULT_LAYOUT;
}
