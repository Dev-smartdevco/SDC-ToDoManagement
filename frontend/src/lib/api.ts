const TOKEN_KEY = "myos.token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://sdc-to-do-management-three.vercel.app/api"
    : "http://localhost:4000/api");

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.error?.message ?? "Something went wrong. Please try again.";
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
      clearToken();
      window.location.href = "/login";
    }
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const endpoints = {
  login: (email: string, password: string) =>
    api<{ token: string; user: { id: string; email: string; name: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => api<{ id: string; email: string; name: string; currentFocusTaskId: string | null }>("/auth/me"),
  today: (date: string) => api<import("./types").TodayDashboard>(`/dashboard/today?date=${date}`),
  review: (date: string) => api<import("./types").WeekReview>(`/dashboard/review?date=${date}`),
  projects: () => api<import("./types").Project[]>("/projects"),
  project: (id: string) => api<import("./types").ProjectDetails>(`/projects/${id}`),
  createProject: (body: unknown) => api("/projects", { method: "POST", body: JSON.stringify(body) }),
  updateProject: (id: string, body: unknown) => api(`/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteProject: (id: string) => api(`/projects/${id}`, { method: "DELETE" }),
  tasks: (params: string) => api<import("./types").TaskListResponse>(`/tasks?${params}`),
  task: (id: string) => api<import("./types").Task>(`/tasks/${id}`),
  createTask: (body: unknown) => api("/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: string, body: unknown) => api(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  patchStatus: (id: string, status: string) =>
    api(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteTask: (id: string) => api(`/tasks/${id}`, { method: "DELETE" }),
  duplicateTask: (id: string) => api(`/tasks/${id}/duplicate`, { method: "POST" }),
  postponeTask: (id: string, date?: string) =>
    api(`/tasks/${id}/postpone`, { method: "POST", body: JSON.stringify({ date }) }),
  capture: (title: string) => api("/tasks/capture", { method: "POST", body: JSON.stringify({ title }) }),
  notes: (params: string) => api<import("./types").Note[]>(`/notes?${params}`),
  note: (id: string) => api<import("./types").Note>(`/notes/${id}`),
  createNote: (body: unknown) => api("/notes", { method: "POST", body: JSON.stringify(body) }),
  updateNote: (id: string, body: unknown) => api(`/notes/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteNote: (id: string) => api(`/notes/${id}`, { method: "DELETE" }),
  timeBlocks: (date: string) => api<import("./types").TimeBlock[]>(`/time-blocks?date=${date}`),
  createTimeBlock: (body: unknown) => api("/time-blocks", { method: "POST", body: JSON.stringify(body) }),
  updateTimeBlock: (id: string, body: unknown) =>
    api(`/time-blocks/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTimeBlock: (id: string) => api(`/time-blocks/${id}`, { method: "DELETE" }),
  activeFocus: () => api<import("./types").FocusSession | null>("/focus/active"),
  startFocus: (taskId: string) =>
    api<import("./types").FocusSession>("/focus/start", { method: "POST", body: JSON.stringify({ taskId }) }),
  pauseFocus: (id: string) => api<import("./types").FocusSession>(`/focus/${id}/pause`, { method: "POST" }),
  resumeFocus: (id: string) => api<import("./types").FocusSession>(`/focus/${id}/resume`, { method: "POST" }),
  completeFocus: (id: string, completeTask = false) =>
    api<import("./types").FocusSession>(`/focus/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ completeTask }),
    }),
  cancelFocus: (id: string) => api<import("./types").FocusSession>(`/focus/${id}/cancel`, { method: "POST" }),
};
