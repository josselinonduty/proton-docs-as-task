import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { moveSection, renameSection, toggleDefaultSection } from '@/lib/model';
import { findStatus } from '@/lib/statuses';
import type { StatusDef, StatusKey } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { SectionNameInput } from '@/components/SectionNameInput';
import { ColorSwatches, statusStyle } from '@/components/StatusColorPicker';
import { useBoard } from './BoardContext';
import { BoardCard } from './BoardCard';
import type { LaidOutBoardColumn } from './boardLayout';

interface BoardColumnProps {
  column: LaidOutBoardColumn;
  /** Section or status whose name input should take focus (after a rename or add). */
  focusSection: string | null;
  focusStatus: StatusKey | null;
  onFocusSection: (name: string) => void;
  onSectionFocusHandled: () => void;
  onStatusFocusHandled: () => void;
}

/** One Workflow, Sections or List column: its header and controls, cards and footer. */
export function BoardColumn({
  column,
  focusSection,
  focusStatus,
  onFocusSection,
  onSectionFocusHandled,
  onStatusFocusHandled,
}: BoardColumnProps) {
  const { t } = useTranslation();
  const board = useBoard();
  const { model, view, narrowed, dnd, statusActions, announce, onChange } = board;
  const { statuses } = model;
  const { col, collapsed, visible: visibleTasks, place } = column;
  const status = view === 'workflow' ? findStatus(statuses, col.key) : undefined;
  const isDoneCol = status?.category === 'done';

  return (
    <div
      className={`pdt-column ${collapsed ? 'pdt-column--collapsed' : ''} ${status?.bg ? 'pdt-column--tinted' : ''} ${board.colorMenuFor === col.key ? 'pdt-column--menu-open' : ''}`}
      style={status ? statusStyle(status) : undefined}
      {...dnd.column(col.key, (id, beforeId) => board.tasks.dropOnColumn(col, id, beforeId))}
    >
      <div className="pdt-column__head">
        <button
          type="button"
          className="pdt-btn pdt-btn-icon pdt-btn-sm"
          aria-expanded={!collapsed}
          aria-label={t(collapsed ? 'board.expandCol' : 'board.collapseCol', {
            label: col.label,
          })}
          title={collapsed ? t('board.expand') : t('board.collapse')}
          onClick={() => board.toggleColumnCollapse(col.key)}
        >
          <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} />
        </button>
        {view === 'sections' ? (
          <SectionNameInput
            name={col.key}
            otherNames={model.sections.filter((x) => x !== col.key)}
            autoFocus={focusSection === col.key}
            onFocusHandled={onSectionFocusHandled}
            onRename={(next, viaKeyboard) => {
              onChange(
                renameSection(model, col.key, next),
                t('board.undo.sectionRenamed', { name: next }),
              );
              announce(t('board.sectionRenamed', { name: next }));
              if (viaKeyboard) onFocusSection(next);
            }}
            onInvalid={announce}
          />
        ) : status ? (
          <span className="pdt-status-name">
            <SectionNameInput
              name={status.label}
              noun="status"
              ignoreCase
              otherNames={statuses.filter((x) => x !== status).map((x) => x.label)}
              autoFocus={focusStatus === status.key}
              onFocusHandled={onStatusFocusHandled}
              onRename={(label) => statusActions.rename(status, label)}
              onInvalid={announce}
            />
          </span>
        ) : (
          <span className="pdt-column__name">{col.label}</span>
        )}
        <span
          className="pdt-column__count"
          aria-label={
            narrowed
              ? t('board.countShown', {
                  shown: visibleTasks.length,
                  count: col.tasks.length,
                })
              : t('count.tasks', { count: col.tasks.length })
          }
        >
          {narrowed ? `${visibleTasks.length}/${col.tasks.length}` : col.tasks.length}
        </span>

        {status && <StatusColumnOps status={status} />}

        {view === 'sections' && <SectionColumnOps name={col.key} label={col.label} />}
      </div>

      {!collapsed && (
        <div className="pdt-column__body" role="list" aria-label={col.label}>
          {visibleTasks.map((task) => (
            <Fragment key={task.id}>
              {dnd.dropTarget?.key === col.key && dnd.dropTarget.beforeId === task.id && (
                <DropPlaceholder />
              )}
              <BoardCard key={task.id} task={task} place={place} />
            </Fragment>
          ))}
          {dnd.dropTarget?.key === col.key && dnd.dropTarget.beforeId === null && (
            <DropPlaceholder />
          )}

          {visibleTasks.length === 0 && (
            <p className="pdt-column__empty">
              {narrowed && col.tasks.length > 0 ? t('board.noMatch') : t('board.empty')}
            </p>
          )}
        </div>
      )}
      {!collapsed && !isDoneCol && (
        <div className="pdt-column__foot">
          <button
            type="button"
            className="pdt-add-task"
            onClick={() => board.openColumnQuickAdd(col)}
          >
            <Icon name="plus" size={14} />
            {t('quickAdd.add')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Section column controls: reorder, show in List, delete. */
function SectionColumnOps({ name, label }: { name: string; label: string }) {
  const { t } = useTranslation();
  const { model, onChange, requestSectionDelete } = useBoard();
  return (
    <div className="pdt-column__ops">
      <button
        type="button"
        className="pdt-btn pdt-btn-icon pdt-btn-sm"
        aria-label={t('board.moveLeft', { label })}
        title={t('board.moveLeftShort')}
        disabled={model.sections.indexOf(name) === 0}
        onClick={() => onChange(moveSection(model, name, -1))}
      >
        <Icon name="chevron-left" />
      </button>
      <button
        type="button"
        className="pdt-btn pdt-btn-icon pdt-btn-sm"
        aria-label={t('board.moveRight', { label })}
        title={t('board.moveRightShort')}
        disabled={model.sections.indexOf(name) === model.sections.length - 1}
        onClick={() => onChange(moveSection(model, name, 1))}
      >
        <Icon name="chevron-right" />
      </button>
      <button
        type="button"
        className="pdt-btn pdt-btn-icon pdt-btn-sm"
        aria-label={t('board.useAsList', { label })}
        aria-pressed={model.defaultSection === name}
        title={t('board.showInList')}
        onClick={() => onChange(toggleDefaultSection(model, name))}
      >
        <Icon name="checkmark-circle" />
      </button>
      <button
        type="button"
        className="pdt-btn pdt-btn-icon pdt-btn-sm"
        aria-label={t('board.deleteSection', { label })}
        title={t('board.deleteSectionShort')}
        onClick={() => requestSectionDelete(name)}
      >
        <Icon name="trash" />
      </button>
    </div>
  );
}

/** Workflow column controls: reorder, colours and delete, like a section's. */
function StatusColumnOps({ status }: { status: StatusDef }) {
  const { t } = useTranslation();
  const board = useBoard();
  const { statusActions, colorMenuFor, setColorMenuFor, setStatusColors } = board;
  const { statuses } = board.model;
  const index = statuses.indexOf(status);
  return (
    <div className="pdt-column__ops">
      <button
        type="button"
        className="pdt-btn pdt-btn-icon pdt-btn-sm"
        aria-label={t('board.moveLeft', { label: status.label })}
        title={t('board.moveLeftShort')}
        disabled={index === 0}
        onClick={() => statusActions.move(status, -1)}
      >
        <Icon name="chevron-left" />
      </button>
      <button
        type="button"
        className="pdt-btn pdt-btn-icon pdt-btn-sm"
        aria-label={t('board.moveRight', { label: status.label })}
        title={t('board.moveRightShort')}
        disabled={index === statuses.length - 1}
        onClick={() => statusActions.move(status, 1)}
      >
        <Icon name="chevron-right" />
      </button>
      <div
        className="pdt-colorpicker"
        ref={colorMenuFor === status.key ? board.colorMenuRef : null}
      >
        <button
          type="button"
          className="pdt-btn pdt-btn-icon pdt-btn-sm"
          aria-label={t('board.colors', { label: status.label })}
          aria-haspopup="dialog"
          aria-expanded={colorMenuFor === status.key}
          title={t('board.colorsShort')}
          onClick={() => setColorMenuFor((k) => (k === status.key ? null : status.key))}
        >
          <Icon name="palette" />
        </button>
        {colorMenuFor === status.key && (
          <div
            className="pdt-colorpicker__panel pdt-colorpicker__panel--end"
            role="dialog"
            aria-label={t('board.colors', { label: status.label })}
          >
            <span className="pdt-field-label">{t('settings.text')}</span>
            <ColorSwatches
              label={t('board.textColor')}
              role="text"
              value={status.color}
              onChange={(color) => setStatusColors(status, { color, bg: status.bg })}
            />
            <span className="pdt-field-label">{t('settings.background')}</span>
            <ColorSwatches
              label={t('board.bgColor')}
              role="bg"
              value={status.bg}
              onChange={(bg) => setStatusColors(status, { color: status.color, bg })}
            />
            <button
              type="button"
              className="pdt-link"
              onClick={() => {
                setColorMenuFor(null);
                board.openBoardSettings();
              }}
            >
              {t('board.allSettings')}
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="pdt-btn pdt-btn-icon pdt-btn-sm"
        aria-label={t('settings.delete', { label: status.label })}
        title={statusActions.removeHint(status)}
        disabled={!statusActions.canRemove(status)}
        onClick={() => board.requestStatusDelete(status.key)}
      >
        <Icon name="trash" />
      </button>
    </div>
  );
}

export function DropPlaceholder() {
  return <div className="pdt-drop-placeholder" aria-hidden="true" />;
}
