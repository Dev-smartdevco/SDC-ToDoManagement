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
};

export type Tag = { id: string; name: string };

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  projectId?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  dueTime?: string | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  completedAt?: string | null;
  parentTaskId?: string | null;
  snoozedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Pick<Project, "id" | "name" | "color" | "icon"> | null;
  tags?: Tag[];
  daysOverdue?: number;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  projectId?: string | null;
  taskId?: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  project?: Pick<Project, "id" | "name" | "color"> | null;
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
};

export type TaskListResponse = {
  items: Task[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
