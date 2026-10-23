// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTask, type BoardTask } from '../lib/model';
import { TaskSubtasks } from './TaskSubtasks';

afterEach(cleanup);

const task = (title: string, status = 'todo'): BoardTask => createTask('Tasks', status, title);

function setup(props: { parent?: BoardTask; subtasks?: BoardTask[]; candidates?: BoardTask[] }) {
  const handlers = {
    onOpen: vi.fn(),
    onAdd: vi.fn(),
    onToggleDone: vi.fn(),
    onDetach: vi.fn(),
    onDelete: vi.fn(),
    onSetParent: vi.fn(),
  };
  render(
    <TaskSubtasks
      parent={props.parent}
      subtasks={props.subtasks ?? []}
      isDone={(t) => t.status === 'done'}
      parentCandidates={() => props.candidates ?? []}
      {...handlers}
    />,
  );
  return handlers;
}

describe('TaskSubtasks', () => {
  it('adds a sub-task on Enter and clears the field', async () => {
    const { onAdd } = setup({});
    const input = screen.getByRole('textbox', { name: 'Add a sub-task' });
    await userEvent.type(input, '  Write tests  {Enter}');
    expect(onAdd).toHaveBeenCalledWith('Write tests');
    expect(input).toHaveProperty('value', '');
    await userEvent.type(input, '   {Enter}');
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('lists sub-tasks with progress and per-item actions', async () => {
    const a = task('Design', 'done');
    const b = task('Build');
    const { onToggleDone, onOpen, onDetach, onDelete } = setup({ subtasks: [a, b] });
    expect(screen.getByText(/1 of 2 done/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Mark Build as done' }));
    expect(onToggleDone).toHaveBeenCalledWith(b.id);
    await userEvent.click(screen.getByText('Design'));
    expect(onOpen).toHaveBeenCalledWith(a.id);
    await userEvent.click(screen.getByRole('button', { name: 'Detach sub-task Build' }));
    expect(onDetach).toHaveBeenCalledWith(b.id);
    await userEvent.click(screen.getByRole('button', { name: 'Delete sub-task Design' }));
    expect(onDelete).toHaveBeenCalledWith(a.id);
  });

  it('picks a parent from the search results', async () => {
    const epic = task('Epic');
    const { onSetParent } = setup({ candidates: [epic, task('Other')] });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search for a parent task' }), 'ep');
    await userEvent.click(screen.getByRole('button', { name: /Epic/ }));
    expect(onSetParent).toHaveBeenCalledWith(epic.id);
  });

  it('shows the current parent and removes it', async () => {
    const epic = task('Epic');
    const { onSetParent, onOpen } = setup({ parent: epic });
    await userEvent.click(screen.getByText('Epic'));
    expect(onOpen).toHaveBeenCalledWith(epic.id);
    await userEvent.click(screen.getByRole('button', { name: 'Remove parent Epic' }));
    expect(onSetParent).toHaveBeenCalledWith(undefined);
  });
});
