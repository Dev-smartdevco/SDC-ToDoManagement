export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "INBOX" | "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type FocusStatus = "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  icon: string;
  color: string;
  progress?: number;
  openTasks?: number;
  completedTasks?: number;
  taskCount?: number;
  noteCount?: number;
  categoryCount?: number;
};

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  projectId: string;
  icon: string;
  color: string;
  sortOrder: number;
  archived?: boolean;
  taskCount?: number;
  completedTasks?: number;
  openTasks?: number;
  project?: Pick<Project, "id" | "name" | "color"> | null;
};

export type Tag = { id: string; name: string };

export type Subtask = {
  id: string;
  title: string;
  status: TaskStatus;
  completedAt?: string | null;
};

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  categoryId?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  dueTime?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  completedAt?: string | null;
  parentTaskId?: string | null;
  snoozedUntil?: string | null;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  project?: Pick<Project, "id" | "name" | "color" | "icon"> | null;
  category?: Pick<Category, "id" | "name" | "color" | "icon" | "projectId"> | null;
  tags?: Tag[];
  subtasks?: Subtask[];
  subtaskProgress?: { total: number; completed: number; percent: number };
  daysOverdue?: number;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  projectId?: string | null;
  categoryId?: string | null;
  taskId?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  project?: Pick<Project, "id" | "name" | "color"> | null;
  category?: Pick<Category, "id" | "name" | "color" | "icon" | "projectId"> | null;
  task?: { id: string; title: string } | null;
};

export type TimeBlock = {
  id: string;
  title: string;
  projectId?: string | null;
  taskId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
  project?: Pick<Project, "id" | "name" | "color"> | null;
  task?: { id: string; title: string } | null;
};

export type FocusSession = {
  id: string;
  taskId: string;
  status: FocusStatus;
  startedAt: string;
  endedAt?: string | null;
  durationMinutes: number;
  accumulatedSeconds: number;
  liveSeconds?: number;
  task?: Task & { project?: Pick<Project, "id" | "name" | "color"> | null };
};

export type TodayDashboard = {
  date: string;
  progress: number;
  plannedCount: number;
  completedCount: number;
  focusMinutes: number;
  overdueCount: number;
  currentFocus: Task | null;
  activeFocus: FocusSession | null;
  todayTasks: { high: Task[]; normal: Task[]; low: Task[] };
  overdue: Task[];
  later: Task[];
  timeBlocks: TimeBlock[];
};

export type WeekReview = {
  today: {
    completed: number;
    planned: number;
    completion: number;
    focusMinutes: number;
    overdue: number;
  };
  week: { date: string; planned: number; completed: number; focusMinutes: number }[];
  topProjects: { id: string; name: string; color: string; completed: number }[];
};

export type ProjectDetails = Project & {
  progress: number;
  openTasks: Task[];
  completedTasks: Task[];
  overdueTasks: Task[];
  upcomingTasks: Task[];
  notes: Note[];
  categories: Category[];
};

export type DashboardStats = {
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  overdueTasks: number;
  categories: Category[];
};

export type TaskListResponse = {
  items: Task[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
