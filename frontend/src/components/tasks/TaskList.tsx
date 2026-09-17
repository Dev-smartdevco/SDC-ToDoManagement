"use client";

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
}: {
  tasks: Task[];
  empty?: string;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDuplicate?: (task: Task) => void;
  onPostpone?: (task: Task) => void;
}) {
  const { t } = useI18n();
  if (!tasks.length) return <EmptyState title={empty ?? t("noTasks")} />;
  return (
    <div>
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onPostpone={onPostpone}
        />
      ))}
    </div>
  );
}
