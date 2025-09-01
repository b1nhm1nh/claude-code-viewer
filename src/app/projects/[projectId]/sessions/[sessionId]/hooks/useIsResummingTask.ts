import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { honoClient } from "../../../../../../lib/api/client";

export const useIsResummingTask = (sessionId: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ["runningTasks"],
    queryFn: async () => {
      const response = await honoClient.api.tasks.running.$get({});

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      return response.json();
    },
    // Only poll when there might be running tasks
    refetchInterval: (query) => {
      const hasRunningTasks = (query.state.data?.runningTasks?.length ?? 0) > 0;
      return hasRunningTasks ? 2000 : false; // Poll every 2s when there are tasks, stop when none
    },
    // Keep data fresh for 30 seconds
    staleTime: 30 * 1000,
    // Keep in cache for 5 minutes
    gcTime: 5 * 60 * 1000,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
  });

  const taskInfo = useMemo(() => {
    const runningTask = data?.runningTasks.find(
      (task) => task.nextSessionId === sessionId,
    );
    return {
      isResummingTask: Boolean(runningTask),
      task: runningTask,
      hasRunningTasks: (data?.runningTasks.length ?? 0) > 0,
    };
  }, [data, sessionId]);

  return {
    ...taskInfo,
    isLoading,
  };
};
