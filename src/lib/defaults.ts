import type {
  BoardView,
  CardFieldVisibility,
  CompletedDisplay,
  DateFormat,
  Settings,
} from './types';

export const DEFAULT_CARD_FIELDS: CardFieldVisibility = {
  description: true,
  priority: true,
  due: true,
  assignee: true,
  labels: true,
  sectionInWorkflow: false,
  statusInSections: false,
};

/**
 * Default activation markers. The first non-empty line of a document must
 * start with one of these (trimmed, case-insensitive) for the board to show.
 */
export const DEFAULT_MARKERS = ['#!tasks', '#!task', ':::tasks'];

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  markers: DEFAULT_MARKERS,
  defaultView: 'workflow',
  autoShow: true,
  theme: 'system',
  density: 'comfortable',
  newCardsAtTop: false,
  showDescriptionPreview: true,
  collapseDoneByDefault: false,
  confirmDelete: true,
  cardFields: DEFAULT_CARD_FIELDS,
  completedDisplay: 'show',
  dateFormat: 'iso',
  userAssignee: '',
};

/**
 * Merge stored settings over the defaults, guarding against empty/invalid
 * values. Also migrates the v0.4 `grouping` field to `defaultView`, and drops
 * the global status labels that statuses defined per document replaced.
 */
export function withDefaults(
  stored?: (Partial<Settings> & { grouping?: string; columns?: unknown }) | null,
): Settings {
  // `columns` (global status labels) predates per-document statuses; drop it.
  const raw = { ...stored };
  delete raw.columns;
  const merged: Settings = { ...DEFAULT_SETTINGS, ...raw } as Settings;

  // Never allow an empty marker configuration.
  merged.markers = (merged.markers ?? []).map((m) => m.trim()).filter(Boolean);
  if (merged.markers.length === 0) merged.markers = DEFAULT_MARKERS;

  // Migrate the legacy `grouping` ('status' | 'section') → `defaultView`.
  if (raw.defaultView == null && typeof raw.grouping === 'string') {
    merged.defaultView = raw.grouping === 'section' ? 'sections' : 'workflow';
  }
  const validViews: BoardView[] = ['workflow', 'sections', 'swimlane', 'list'];
  if (!validViews.includes(merged.defaultView)) merged.defaultView = 'workflow';

  if (!['system', 'light', 'dark'].includes(merged.theme)) merged.theme = 'system';
  if (!['comfortable', 'compact'].includes(merged.density)) merged.density = 'comfortable';

  // Card field visibility: merge stored booleans over the defaults.
  merged.cardFields = { ...DEFAULT_CARD_FIELDS, ...(raw.cardFields ?? {}) };

  // Completed display: honor an explicit stored choice; otherwise migrate the
  // legacy `collapseDoneByDefault` flag.
  const completed: CompletedDisplay[] = ['show', 'collapse', 'hide'];
  if (!completed.includes(raw.completedDisplay as CompletedDisplay)) {
    merged.completedDisplay = raw.collapseDoneByDefault ? 'collapse' : 'show';
  }
  // Keep the legacy flag consistent for any code still reading it.
  merged.collapseDoneByDefault = merged.completedDisplay === 'collapse';

  const formats: DateFormat[] = ['iso', 'medium', 'us', 'euro'];
  if (!formats.includes(merged.dateFormat)) merged.dateFormat = 'iso';

  merged.userAssignee = typeof merged.userAssignee === 'string' ? merged.userAssignee.trim() : '';

  return merged;
}

/** True when a candidate markers list is non-empty after trimming. */
export function markersAreValid(markers: string[]): boolean {
  return markers.some((m) => m.trim() !== '');
}
