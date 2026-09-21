export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "INBOX" | "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "CANCELLED";
export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type FocusStatus = "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MEMBER" | "VIEWER";

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  icon: string;
  color: string;
  isDefault?: boolean;
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
  project?: Pick<Project, "id" | "name" | "color" | "icon" | "isDefault"> | null;
  category?: Pick<Category, "id" | "name" | "color" | "icon" | "projectId"> | null;
  tags?: Tag[];
  subtasks?: Subtask[];
  subtaskProgress?: { total: number; completed: number; percent: number };
  daysOverdue?: number;
  assignees?: Assignee[];
  blockedReason?: string | null;
  blockedBy?: PublicUser | null;
  comments?: TaskComment[];
  files?: FileLink[];
  activities?: ActivityItem[];
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
  project?: Pick<Project, "id" | "name" | "color" | "isDefault"> | null;
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
  todayTasks: { default?: Task[]; high: Task[]; normal: Task[]; low: Task[] };
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
  members?: ProjectMember[];
  files?: FileLink[];
  activity?: ActivityItem[];
  blockedTasks?: Task[];
  dueSoon?: number;
  todoCount?: number;
  inProgressCount?: number;
  blockedCount?: number;
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

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
};

export type Assignee = PublicUser & { isPrimary?: boolean };

export type AuthUser = PublicUser & {
  currentFocusTaskId: string | null;
  mustChangePassword: boolean;
  xp: number;
  level: number;
  intoLevel?: number;
  progress?: number;
};

export type ManagedUser = PublicUser & {
  createdAt: string;
  lastLoginAt: string | null;
  xp: number;
  level: number;
  activeTasks: number;
  completedTasks: number;
  projectsCount: number;
  temporaryPassword?: string;
};

export type TaskComment = {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  user: PublicUser;
};

export type FileLink = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  user?: PublicUser;
};

export type ActivityItem = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor?: PublicUser;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  taskId?: string | null;
  projectId?: string | null;
  createdAt: string;
};

export type RecognitionPost = {
  id: string;
  message: string;
  createdAt: string;
  visibility: "EVERYONE" | "TEAM" | "PROJECT";
  author: PublicUser;
  recipient: PublicUser;
  project?: Pick<Project, "id" | "name" | "color"> | null;
  task?: { id: string; title: string } | null;
};

export type Achievement = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  earned?: boolean;
  earnedAt?: string;
};

export type ProjectMember = {
  projectId: string;
  userId: string;
  role: "OWNER" | "MEMBER";
  joinedAt: string;
  user: PublicUser;
};

