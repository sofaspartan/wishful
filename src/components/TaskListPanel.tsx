import { useState, type FormEvent } from 'react';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import type { ListKind, ListTask } from '../../shared/types';
import { del, errorMessage, patch, post, put } from '../lib/api';
import { DragHandle, SortableList, type HandleProps } from './Sortable';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { useConfirm } from './ui/misc';

interface Props {
  wishlistId: string;
  kind: ListKind;
  tasks: ListTask[];
  canEdit: boolean;
  readOnly?: boolean;
  onChange: (tasks: ListTask[]) => void;
}

/** Text rows for standard / checklist / todo lists — reorder, complete, delete. */
export function TaskListPanel({ wishlistId, kind, tasks, canEdit, readOnly, onChange }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const editable = canEdit && !readOnly;
  const showComplete = kind === 'checklist' || kind === 'todo';

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !editable) return;
    setAdding(true);
    try {
      const res = await post<{ task: ListTask }>(`/api/wishlists/${wishlistId}/tasks`, { text });
      onChange([...tasks, res.task]);
      setDraft('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const setDone = async (task: ListTask) => {
    if (!editable || !showComplete) return;
    setBusyId(task.id);
    const nextDone = !task.done;
    const previous = tasks;
    onChange(
      tasks.map((t) =>
        t.id === task.id ? { ...t, done: nextDone, completedAt: nextDone ? new Date().toISOString() : null } : t,
      ),
    );
    try {
      const res = await patch<{ task: ListTask }>(`/api/wishlists/${wishlistId}/tasks/${task.id}`, { done: nextDone });
      onChange(previous.map((t) => (t.id === task.id ? res.task : t)));
    } catch (err) {
      onChange(previous);
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (task: ListTask) => {
    if (!editable) return;
    if (
      !(await confirm({
        title: 'Remove this row?',
        message: task.text,
        confirmLabel: 'Remove',
        danger: true,
      }))
    ) {
      return;
    }
    setBusyId(task.id);
    const previous = tasks;
    onChange(tasks.filter((t) => t.id !== task.id));
    try {
      await del(`/api/wishlists/${wishlistId}/tasks/${task.id}`);
    } catch (err) {
      onChange(previous);
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const reorder = async (ids: string[]) => {
    if (!editable) return;
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const next = ids.map((id) => byId.get(id)!).filter(Boolean);
    const previous = tasks;
    onChange(next);
    try {
      await put(`/api/wishlists/${wishlistId}/tasks/order`, { ids });
    } catch (err) {
      onChange(previous);
      toast.error(errorMessage(err));
    }
  };

  const row = (task: ListTask, handle?: HandleProps) => {
    const done = showComplete && task.done;
    return (
      <div className={['task-row', done && 'is-done', kind === 'todo' && 'is-todo', kind === 'checklist' && 'is-checklist'].filter(Boolean).join(' ')}>
        {editable && handle && <DragHandle handle={handle} label={`Reorder ${task.text}`} />}
        {showComplete && (
          <button
            type="button"
            className={['task-toggle', kind === 'todo' ? 'task-toggle-radio' : 'task-toggle-check'].join(' ')}
            aria-pressed={done}
            aria-label={done ? 'Mark not done' : 'Mark done'}
            disabled={!editable || busyId === task.id}
            onClick={() => void setDone(task)}
          >
            {kind === 'todo' ? (
              done ? (
                <Check size={14} aria-hidden />
              ) : (
                <Circle size={14} aria-hidden />
              )
            ) : done ? (
              <Check size={14} aria-hidden />
            ) : (
              <span className="task-check-box" aria-hidden />
            )}
          </button>
        )}
        <span className="task-text">{task.text}</span>
        {editable && (
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            icon={<Trash2 size={15} />}
            aria-label="Remove"
            disabled={busyId === task.id}
            onClick={() => void remove(task)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="task-list-panel stack">
      {editable && (
        <form className="task-add-row" onSubmit={(e) => void add(e)}>
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={kind === 'todo' ? 'Add a to-do…' : kind === 'checklist' ? 'Add a checklist item…' : 'Add a line…'}
            maxLength={200}
            aria-label="New row"
          />
          <Button type="submit" variant="primary" icon={<Plus size={16} />} loading={adding} disabled={!draft.trim()}>
            Add
          </Button>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="muted text-sm" style={{ margin: 0 }}>
          {editable ? 'Nothing here yet — add a line above.' : 'This list is empty.'}
        </p>
      ) : editable ? (
        <SortableList
          ids={tasks.map((t) => t.id)}
          layout="list"
          onReorder={(ids) => void reorder(ids)}
          className="task-rows"
          renderItem={(id, handle) => {
            const task = tasks.find((t) => t.id === id);
            return task ? row(task, handle) : null;
          }}
        />
      ) : (
        <div className="task-rows">
          {tasks.map((t) => (
            <div key={t.id}>{row(t)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
