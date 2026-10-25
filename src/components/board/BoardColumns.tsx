import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addSection } from '../../lib/model';
import type { StatusKey } from '../../lib/types';
import { Icon } from '../Icon';
import { useBoard } from './BoardContext';
import { BoardColumn } from './BoardColumn';
import type { LaidOutBoardColumn } from './boardLayout';

/** The Workflow, Sections and List views: columns side by side (List: one, full width). */
export function BoardColumns({ columns }: { columns: LaidOutBoardColumn[] }) {
  const { t } = useTranslation();
  const { model, view, onChange, announce, statusActions } = useBoard();
  // Name inputs to focus once they render: a section renamed with Enter, a status just added.
  const [focusSection, setFocusSection] = useState<string | null>(null);
  const [focusStatus, setFocusStatus] = useState<StatusKey | null>(null);
  const clearFocusSection = useCallback(() => setFocusSection(null), []);
  const clearFocusStatus = useCallback(() => setFocusStatus(null), []);

  return (
    <div className={`pdt-columns ${view === 'list' ? 'pdt-columns--list' : ''}`}>
      {columns.map((column) => (
        <BoardColumn
          key={column.col.key}
          column={column}
          focusSection={focusSection}
          focusStatus={focusStatus}
          onFocusSection={setFocusSection}
          onSectionFocusHandled={clearFocusSection}
          onStatusFocusHandled={clearFocusStatus}
        />
      ))}

      {view === 'workflow' && (
        <div className="pdt-column pdt-column--add">
          <button
            type="button"
            className="pdt-add-column"
            onClick={() => setFocusStatus(statusActions.add())}
          >
            <Icon name="plus" size={14} />
            {t('settings.add')}
          </button>
        </div>
      )}

      {view === 'sections' && (
        <div className="pdt-column pdt-column--add">
          <button
            type="button"
            className="pdt-add-column"
            onClick={() => {
              onChange(addSection(model));
              announce(t('board.sectionAdded'));
            }}
          >
            <Icon name="plus" size={14} />
            {t('board.addSection')}
          </button>
        </div>
      )}
    </div>
  );
}
