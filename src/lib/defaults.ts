import { isLanguage } from '../i18n/languages';
import { DATE_FORMATS } from './dates';
import {
  BOARD_VIEWS,
  CARD_DENSITIES,
  COMPLETED_DISPLAYS,
  STATUS_FLOWS,
  THEMES,
  type CardFieldVisibility,
  type Settings,
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
  language: 'auto',
  theme: 'system',
  density: 'comfortable',
  newCardsAtTop: false,
  showDescriptionPreview: true,
  confirmDelete: true,
  cardFields: DEFAULT_CARD_FIELDS,
  completedDisplay: 'show',
  dateFormat: 'iso',
  userAssignee: '',
  defaultStatuses: 'standard',
};

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

/**
 * Merge stored settings over the defaults, replacing invalid values and
 * dropping unknown keys.
 */
export function withDefaults(stored?: Partial<Settings> | null): Settings {
  const s = { ...DEFAULT_SETTINGS, ...stored };
  const markers = (s.markers ?? []).map((m) => m.trim()).filter(Boolean);
  return {
    enabled: s.enabled,
    markers: markers.length > 0 ? markers : DEFAULT_MARKERS,
    defaultView: oneOf(BOARD_VIEWS, s.defaultView, DEFAULT_SETTINGS.defaultView),
    autoShow: s.autoShow,
    language: s.language === 'auto' || isLanguage(s.language) ? s.language : 'auto',
    theme: oneOf(THEMES, s.theme, DEFAULT_SETTINGS.theme),
    density: oneOf(CARD_DENSITIES, s.density, DEFAULT_SETTINGS.density),
    newCardsAtTop: s.newCardsAtTop,
    showDescriptionPreview: s.showDescriptionPreview,
    confirmDelete: s.confirmDelete,
    cardFields: { ...DEFAULT_CARD_FIELDS, ...stored?.cardFields },
    completedDisplay: oneOf(
      COMPLETED_DISPLAYS,
      s.completedDisplay,
      DEFAULT_SETTINGS.completedDisplay,
    ),
    dateFormat: oneOf(DATE_FORMATS, s.dateFormat, DEFAULT_SETTINGS.dateFormat),
    userAssignee: typeof s.userAssignee === 'string' ? s.userAssignee.trim() : '',
    defaultStatuses: oneOf(STATUS_FLOWS, s.defaultStatuses, DEFAULT_SETTINGS.defaultStatuses),
  };
}

/** Fields of v1 settings that later versions replaced. */
export interface LegacySettings extends Partial<Settings> {
  /** v0.4 view choice, replaced by `defaultView`. */
  grouping?: 'status' | 'section';
  /** Replaced by `completedDisplay: 'collapse'`. */
  collapseDoneByDefault?: boolean;
  /** Global status labels, replaced by statuses defined per document. */
  columns?: unknown;
}

/** Storage migration v1 → v2: maps legacy fields onto their replacements. */
export function migrateLegacySettings({
  grouping,
  collapseDoneByDefault,
  ...stored
}: LegacySettings): Settings {
  return withDefaults({
    ...stored,
    defaultView: stored.defaultView ?? (grouping === 'section' ? 'sections' : undefined),
    completedDisplay: stored.completedDisplay ?? (collapseDoneByDefault ? 'collapse' : undefined),
  });
}
