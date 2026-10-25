import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  moveTasksToStatus,
  removeSection,
  removeSectionMovingTasks,
  removeStatus,
  type BoardTask,
  type OrphanStatus,
} from '../../lib/model';
import { findStatus } from '../../lib/statuses';
import type { StatusKey } from '../../lib/types';
import { BoardSettingsDialog } from '../BoardSettingsDialog';
import { Dialog } from '../Dialog';
import { MissingStatusDialog, StatusDeleteDialog } from '../StatusDialogs';
import { useBoard } from './BoardContext';
import type { BoardOverlay, BoardOverlayKind } from './useBoardOverlay';

/** A status delete waiting for the user to say where its tasks go. */
export interface PendingStatusDelete {
  key: StatusKey;
  count: number;
}

interface BoardConfirmDialogsProps {
  overlay: BoardOverlay;
  closeOverlay: (kind: BoardOverlayKind) => void;
  openBoardSettings: () => void;
  pendingStatusDelete: PendingStatusDelete | null;
  onStatusDeleteDone: () => void;
  orphans: OrphanStatus[];
  selectedCount: number;
  onDeleteCard: (task: BoardTask) => void;
  onDeleteSelected: () => void;
  onRequestStatusDelete: (key: StatusKey) => void;
}

/**
 * The board's confirmations: delete a card, the selection, a section or a
 * status, and move tasks whose status is missing. Board settings renders
 * here too, between them, so a status delete it asks for stacks on top.
 */
export function BoardConfirmDialogs(props: BoardConfirmDialogsProps) {
  const { t } = useTranslation();
  const { model, onChange, announce } = useBoard();
  const { statuses } = model;
  const { overlay, closeOverlay, pendingStatusDelete } = props;
  const statusToDelete = pendingStatusDelete && findStatus(statuses, pendingStatusDelete.key);

  const moveOrphans = (targets: Record<StatusKey, StatusKey>) => {
    let next = model;
    for (const [from, to] of Object.entries(targets)) next = moveTasksToStatus(next, from, to);
    onChange(next, t('board.undo.orphans'));
    announce(t('board.tasksMoved'));
  };

  return (
    <>
      {overlay.kind === 'deleteCard' && (
        <Dialog title={t('details.delete')} onClose={() => closeOverlay('deleteCard')}>
          <p className="pdt-modal__text">
            {t('board.confirmDelete', { title: overlay.task.title || t('board.thisTask') })}
          </p>
          <div className="pdt-modal__actions">
            <button className="pdt-btn" onClick={() => closeOverlay('deleteCard')}>
              {t('common.cancel')}
            </button>
            <button
              className="pdt-btn pdt-btn-danger-solid"
              onClick={() => props.onDeleteCard(overlay.task)}
            >
              {t('common.delete')}
            </button>
          </div>
        </Dialog>
      )}

      {overlay.kind === 'deleteBulk' && (
        <Dialog title={t('board.deleteSelected')} onClose={() => closeOverlay('deleteBulk')}>
          <p className="pdt-modal__text">
            {t('board.confirmBulk', { count: props.selectedCount })}
          </p>
          <div className="pdt-modal__actions">
            <button className="pdt-btn" onClick={() => closeOverlay('deleteBulk')}>
              {t('common.cancel')}
            </button>
            <button
              className="pdt-btn pdt-btn-danger-solid"
              onClick={() => {
                props.onDeleteSelected();
                closeOverlay('deleteBulk');
              }}
            >
              {t('common.delete')}
            </button>
          </div>
        </Dialog>
      )}

      {overlay.kind === 'deleteSection' && (
        <SectionDeleteDialog
          info={overlay}
          sections={model.sections.filter((s) => s !== overlay.name)}
          onCancel={() => closeOverlay('deleteSection')}
          onMove={(target) => {
            onChange(
              removeSectionMovingTasks(model, overlay.name, target),
              t('board.undo.sectionMoved'),
            );
            announce(t('board.sectionMoved', { name: overlay.name, target }));
            closeOverlay('deleteSection');
          }}
          onDeleteAll={() => {
            onChange(removeSection(model, overlay.name), t('board.undo.sectionAll'));
            announce(t('board.sectionAll', { name: overlay.name }));
            closeOverlay('deleteSection');
          }}
        />
      )}

      {overlay.kind === 'boardSettings' && (
        <BoardSettingsDialog
          model={model}
          announce={announce}
          onChange={onChange}
          onRequestDelete={props.onRequestStatusDelete}
          onClose={() => closeOverlay('boardSettings')}
        />
      )}

      {statusToDelete && (
        <StatusDeleteDialog
          status={statusToDelete}
          count={pendingStatusDelete!.count}
          targets={statuses.filter((st) => st !== statusToDelete)}
          onCancel={props.onStatusDeleteDone}
          onConfirm={(target) => {
            const status = statusToDelete;
            const label = findStatus(statuses, target)?.label ?? target;
            onChange(
              removeStatus(model, status.key, target),
              t('board.undo.statusDeleted', { label: status.label }),
            );
            announce(t('board.statusMoved', { label: status.label, target: label }));
            props.onStatusDeleteDone();
          }}
        />
      )}

      {props.orphans.length > 0 && overlay.kind !== 'boardSettings' && (
        <MissingStatusDialog
          orphans={props.orphans}
          statuses={statuses}
          onMove={moveOrphans}
          onOpenSettings={props.openBoardSettings}
        />
      )}
    </>
  );
}

interface SectionDeleteDialogProps {
  info: { name: string; count: number };
  sections: string[];
  onCancel: () => void;
  onMove: (target: string) => void;
  onDeleteAll: () => void;
}

function SectionDeleteDialog({
  info,
  sections,
  onCancel,
  onMove,
  onDeleteAll,
}: SectionDeleteDialogProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(sections[0] ?? '');
  return (
    <Dialog title={t('sectionDialog.title', { name: info.name })} onClose={onCancel}>
      <p className="pdt-modal__text">
        {t('sectionDialog.text', { name: info.name, count: info.count })}
      </p>

      {sections.length > 0 && (
        <div className="pdt-modal__choice">
          <label className="pdt-field pdt-field--grow">
            <span className="pdt-field-label">{t('statusDialog.moveTo')}</span>
            <select
              className="pdt-select"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button className="pdt-btn pdt-btn-primary" onClick={() => onMove(target)}>
            {t('sectionDialog.move')}
          </button>
        </div>
      )}

      <div className="pdt-modal__actions">
        <button className="pdt-btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button className="pdt-btn pdt-btn-danger" onClick={onDeleteAll}>
          {t('sectionDialog.deleteAll')}
        </button>
      </div>
    </Dialog>
  );
}
