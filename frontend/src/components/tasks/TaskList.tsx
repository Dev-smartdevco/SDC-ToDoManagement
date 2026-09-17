"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Task } from "@/lib/types";
import { TaskItem } from "./TaskItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n";

export function TaskList({
  tasks,
  empty,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onPostpone,
  onReorder,
}: {
  tasks: Task[];
  empty?: string;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
  onPostpone?: (task: Task) => void;
  onReorder?: (ids: string[]) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState(tasks);
  const sortable = Boolean(onReorder) && items.length > 1;

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => items.map((task) => task.id), [items]);

  async function handleDragEnd(event: DragEndEvent) {
    if (!onReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((task) => task.id === active.id);
    const newIndex = items.findIndex((task) => task.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    try {
      await onReorder(next.map((task) => task.id));
    } catch {
      setItems(previous);
    }
  }

  if (!items.length) return <EmptyState title={empty ?? t("noTasks")} />;

  const list = items.map((task) =>
    sortable ? (
      <SortableTaskItem
        key={task.id}
        task={task}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onPostpone={onPostpone}
      />
    ) : (
      <TaskItem
        key={task.id}
        task={task}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onPostpone={onPostpone}
      />
    ),
  );

  if (!sortable) return <div>{list}</div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div>{list}</div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onPostpone,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
  onPostpone?: (task: Task) => void;
}) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskItem
        task={task}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onPostpone={onPostpone}
        dragHandle={
          <button
            type="button"
            className="mt-0.5 touch-none rounded-md p-0.5 text-muted hover:bg-bg hover:text-ink"
            aria-label={t("reorder")}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
        }
      />
    </div>
  );
}
