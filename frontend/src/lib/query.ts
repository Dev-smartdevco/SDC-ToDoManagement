import { keepPreviousData, type QueryClient } from "@tanstack/react-query";

export { keepPreviousData };

export const queryDefaults = {
  staleTime: 2 * 60_000,
  gcTime: 20 * 60_000,
  retry: 1,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const;

export function invalidateWorkspace(queryClient: QueryClient, userId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [userId, "today"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "tasks"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "projects"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "notes"] }),
  ]);
}
