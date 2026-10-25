import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { statusStyle } from '@/components/StatusColorPicker';
import { useBoard } from './BoardContext';
import { BoardCard } from './BoardCard';
import { DropPlaceholder } from './BoardColumn';
import type { SwimlaneRow } from './boardLayout';

/** The Swimlane view: a row per section, a cell per status. */
export function BoardSwimlane({ rows }: { rows: SwimlaneRow[] }) {
  const { t } = useTranslation();
  const { model, dnd, tasks, toggleRowCollapse } = useBoard();
  const { statuses } = model;
  return (
    <div className="pdt-swimlane" role="table" aria-label={t('board.swimlane')}>
      <div
        className="pdt-swimlane__head"
        role="row"
        style={{ '--pdt-swimlane-cols': statuses.length }}
      >
        <div className="pdt-swimlane__corner" role="columnheader">
          {t('quickAdd.section')}
        </div>
        {statuses.map((c) => (
          <div
            key={c.key}
            className="pdt-swimlane__colhead"
            role="columnheader"
            style={statusStyle(c)}
          >
            <span className="pdt-status-pill">{c.label}</span>
          </div>
        ))}
      </div>

      {rows.map(({ section, collapsed, count, cells }) => (
        <div
          key={section}
          className="pdt-swimlane__row"
          role="row"
          style={{ '--pdt-swimlane-cols': statuses.length }}
        >
          <div className="pdt-swimlane__rowhead" role="rowheader">
            <button
              type="button"
              className="pdt-btn pdt-btn-icon"
              aria-expanded={!collapsed}
              aria-label={t(collapsed ? 'board.expandCol' : 'board.collapseCol', {
                label: section,
              })}
              onClick={() => toggleRowCollapse(section)}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
            </button>
            <span className="pdt-swimlane__rowname">{section}</span>
            <span className="pdt-column__count">{count}</span>
          </div>

          {collapsed
            ? null
            : cells.map(({ status: c, cell }) => (
                <div
                  key={c.key}
                  className={`pdt-swimlane__cell ${c.bg ? 'pdt-swimlane__cell--tinted' : ''}`}
                  style={statusStyle(c)}
                  role="cell"
                  {...dnd.cell(cell.col.key, (id) => tasks.dropOnCell(section, c.key, id))}
                >
                  {cell.visible.map((task) => (
                    <BoardCard key={task.id} task={task} place={cell.place} />
                  ))}
                  {dnd.dropTarget?.key === cell.col.key && <DropPlaceholder />}
                </div>
              ))}
        </div>
      ))}
    </div>
  );
}
