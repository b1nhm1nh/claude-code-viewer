import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { honoClient } from "../../../../../../lib/api/client";

export const useAliveTask = (sessionId: string) => {
  const { data } = useQuery({
    queryKey: ["aliveTasks"],
    queryFn: async () => {
      const response = await honoClient.api.tasks.alive.$get({});

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      return response.json();
    },
    refetchOnReconnect: true,
  });

  const taskInfo = useMemo(() => {
    const aliveTask = data?.aliveTasks.find(
      (task) => task.sessionId === sessionId,
    );
    return {
      aliveTask,
      isRunningTask: aliveTask?.status === "running",
      isPausedTask: aliveTask?.status === "paused",
    } as const;
  }, [data, sessionId]);

  return taskInfo;
};
