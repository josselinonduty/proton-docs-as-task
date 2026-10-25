import { useTranslation } from 'react-i18next';
import type { SaveState } from '@/lib/types';
import type { Command } from '@/components/CommandPalette';

interface BoardCommandsOptions {
  filtersActive: boolean;
  saveState: SaveState;
  hideCompleted: boolean;
  doneCollapsed: boolean;
  addTask: () => void;
  focusSearch: () => void;
  cycleView: () => void;
  clearFilters: () => void;
  openSort: () => void;
  toggleHideCompleted: () => void;
  toggleDoneCollapsed: () => void;
  openBoardSettings: () => void;
  openSettings: () => void;
  back: () => void;
  openHelp: () => void;
  retry: () => void;
}

/** The command palette's commands. Each is also reachable elsewhere in the board. */
export function useBoardCommands(a: BoardCommandsOptions): Command[] {
  const { t } = useTranslation();
  return [
    { id: 'add', title: t('quickAdd.add'), hint: 'N', run: a.addTask },
    { id: 'search', title: t('board.search'), hint: '/', keywords: 'find', run: a.focusSearch },
    {
      id: 'view',
      title: t('commands.switchView'),
      hint: 'V',
      keywords: 'workflow sections swimlane list',
      run: a.cycleView,
    },
    {
      id: 'clear',
      title: t('board.clearFilters'),
      keywords: 'reset',
      disabled: !a.filtersActive,
      disabledReason: t('commands.noFilters'),
      run: a.clearFilters,
    },
    { id: 'sort', title: t('commands.sorting'), hint: 'S', run: a.openSort },
    {
      id: 'completed',
      title: a.hideCompleted ? t('commands.showCompleted') : t('commands.hideCompleted'),
      keywords: 'done',
      run: a.toggleHideCompleted,
    },
    {
      id: 'collapse-done',
      title: a.doneCollapsed ? t('commands.expandDone') : t('commands.collapseDone'),
      run: a.toggleDoneCollapsed,
    },
    {
      id: 'board-settings',
      title: t('settings.title'),
      keywords: t('commands.settingsKeywords'),
      run: a.openBoardSettings,
    },
    { id: 'settings', title: t('commands.openSettings'), run: a.openSettings },
    { id: 'back', title: t('board.back'), run: a.back },
    { id: 'shortcuts', title: t('commands.shortcuts'), hint: '?', run: a.openHelp },
    {
      id: 'retry',
      title: t('commands.retry'),
      disabled: a.saveState !== 'error',
      disabledReason: t('commands.saved'),
      run: a.retry,
    },
  ];
}
