import {
  addColumn,
  addTask,
  countTasks,
  moveTask,
  removeColumn,
  removeTask,
  renameColumn,
  setTitle,
  updateTask,
  type BoardModel,
  type EditableTask,
} from '../lib/model';
import { EditableTaskCard } from './EditableTaskCard';

interface EditableBoardProps {
  model: BoardModel;
  onChange: (next: BoardModel) => void;
  onClose: () => void;
}

export function EditableBoard({ model, onChange, onClose }: EditableBoardProps) {
  const { total, done } = countTasks(model);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const patchTask = (taskId: string, patch: Partial<EditableTask>) =>
    onChange(updateTask(model, taskId, patch));

  return (
    <section className="pdt-board" role="dialog" aria-label="Task board">
      <header className="pdt-board__header">
        <div className="pdt-board__titlewrap">
          <span className="pdt-logo" aria-hidden="true">
            ✓
          </span>
          <input
            className="pdt-board__title-input"
            value={model.title ?? ''}
            placeholder="Untitled board"
            aria-label="Board title"
            onChange={(e) => onChange(setTitle(model, e.target.value))}
          />
          <span className="pdt-board__count">
            {done}/{total} done
          </span>
        </div>

        <div className="pdt-board__controls">
          <button className="pdt-close" onClick={onClose} aria-label="Close board">
            Back to doc ✕
          </button>
        </div>
      </header>

      <div className="pdt-progress" aria-hidden="true">
        <div className="pdt-progress__bar" style={{ width: `${pct}%` }} />
      </div>

      <div className="pdt-columns">
        {model.columns.map((column) => (
          <div className="pdt-column" key={column.id}>
            <div className="pdt-column__head">
              <input
                className="pdt-column__name-input"
                value={column.name}
                placeholder="Column name"
                aria-label="Column name"
                onChange={(e) => onChange(renameColumn(model, column.id, e.target.value))}
              />
              <span className="pdt-column__count">{column.tasks.length}</span>
              <button
                type="button"
                className="pdt-icon-btn"
                title="Delete column"
                aria-label="Delete column"
                onClick={() => {
                  if (
                    column.tasks.length === 0 ||
                    confirm(`Delete "${column.name || 'this column'}" and its tasks?`)
                  ) {
                    onChange(removeColumn(model, column.id));
                  }
                }}
              >
                ✕
              </button>
            </div>
            <div className="pdt-column__body">
              {column.tasks.map((task) => (
                <EditableTaskCard
                  key={task.id}
                  task={task}
                  columns={model.columns}
                  columnId={column.id}
                  onChange={(patch) => patchTask(task.id, patch)}
                  onDelete={() => onChange(removeTask(model, task.id))}
                  onMove={(toColumnId) => onChange(moveTask(model, task.id, toColumnId))}
                />
              ))}
              <button
                type="button"
                className="pdt-add-task"
                onClick={() => onChange(addTask(model, column.id))}
              >
                + Add task
              </button>
            </div>
          </div>
        ))}

        <div className="pdt-column pdt-column--add">
          <button
            type="button"
            className="pdt-add-column"
            onClick={() => onChange(addColumn(model))}
          >
            + Add column
          </button>
        </div>
      </div>
    </section>
  );
}
