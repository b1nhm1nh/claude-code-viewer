"use client";

import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { ListTodoIcon } from "lucide-react";
import type { FC } from "react";
import { honoClient } from "@/lib/api/client";
import { aliveTasksAtom } from "../../store/aliveTasksAtom";
import { TaskCard } from "./TaskCard";

export const TasksTab: FC<{ projectId: string }> = ({ projectId }) => {
  const [aliveTasks] = useAtom(aliveTasksAtom);

  const abortTask = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await honoClient.api.tasks.abort.$post({
        json: { sessionId },
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      return response.json();
    },
  });

  const copyTaskId = (taskId: string) => {
    navigator.clipboard.writeText(taskId);
  };

  // Group tasks by status
  const runningTasks = aliveTasks.filter((task) => task.status === "running");
  const pausedTasks = aliveTasks.filter((task) => task.status === "paused");

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-sidebar-border p-4">
        <h2 className="font-semibold text-lg">Alive Sessions</h2>
        <p className="text-xs text-sidebar-foreground/70">
          {runningTasks.length} running, {pausedTasks.length} paused
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {aliveTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center pt-8">
            <div className="text-center text-sidebar-foreground/60">
              <ListTodoIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No alive sessions</p>
            </div>
          </div>
        ) : (
          <>
            {/* Running Tasks Section */}
            {runningTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wide">
                    Running ({runningTasks.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {runningTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      projectId={projectId}
                      onAbortTask={(sessionId) => abortTask.mutate(sessionId)}
                      onCopyTaskId={copyTaskId}
                      isAbortPending={abortTask.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Paused Tasks Section */}
            {pausedTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2 h-2 bg-orange-500 rounded-full" />
                  <h3 className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wide">
                    Paused ({pausedTasks.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {pausedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      projectId={projectId}
                      onAbortTask={(sessionId) => abortTask.mutate(sessionId)}
                      onCopyTaskId={copyTaskId}
                      isAbortPending={abortTask.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
