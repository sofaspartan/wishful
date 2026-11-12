import type { ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export type HandleProps = Record<string, unknown> & { ref: (el: HTMLElement | null) => void };

interface Props {
  ids: string[];
  onReorder: (ids: string[]) => void;
  layout: 'grid' | 'list';
  className?: string;
  /** Non-sortable cell rendered first in the same grid/list (e.g. cash fund card). */
  leading?: ReactNode;
  renderItem: (id: string, handle: HandleProps) => ReactNode;
}

/**
 * Drag-and-drop reordering via a dedicated handle (so taps and scrolling still
 * work on touch screens). Keyboard: focus a handle, Space to lift, arrows to move.
 */
export function SortableList({ ids, onReorder, layout, className, leading, renderItem }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {leading}
          {ids.map((id) => (
            <SortableNode key={id} id={id}>
              {(handle) => renderItem(id, handle)}
            </SortableNode>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableNode({ id, children }: { id: string; children: (handle: HandleProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`sortable-node${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition, position: 'relative' }}
    >
      {children({ ref: setActivatorNodeRef, ...attributes, ...listeners })}
    </div>
  );
}

export function DragHandle({ handle, label }: { handle: HandleProps; label: string }) {
  return (
    <button type="button" className="btn btn-icon btn-sm drag-handle" aria-label={label} {...handle}>
      <GripVertical size={16} aria-hidden />
    </button>
  );
}
