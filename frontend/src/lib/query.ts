import { keepPreviousData, type QueryClient } from "@tanstack/react-query";

export { keepPreviousData };

export const queryDefaults = {
  staleTime: 60_000,
  gcTime: 15 * 60_000,
  retry: 1,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
  refetchOnMount: true,
} as const;

export function invalidateWorkspace(queryClient: QueryClient, userId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [userId, "today"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "tasks"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "review"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "projects"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "notes"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "categories"] }),
    queryClient.invalidateQueries({ queryKey: [userId, "stats"] }),
  ]);
}
