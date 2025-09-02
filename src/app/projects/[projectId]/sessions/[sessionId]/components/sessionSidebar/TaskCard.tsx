"use client";

import { PauseIcon, PlayIcon, XIcon } from "lucide-react";
import Link from "next/link";
import type { FC } from "react";
import { Button } from "@/components/ui/button";

type TaskType = {
  id: string;
  status: "running" | "paused";
  sessionId: string;
  userMessageId: string;
};

export const TaskCard: FC<{
  task: TaskType;
  projectId: string;
  onAbortTask: (sessionId: string) => void;
  onCopyTaskId: (taskId: string) => void;
  isAbortPending: boolean;
}> = ({ task, projectId, onAbortTask, onCopyTaskId, isAbortPending }) => (
  <Link
    href={`/projects/${projectId}/sessions/${encodeURIComponent(task.sessionId)}`}
    className="block rounded-lg p-3 border border-sidebar-border/40 bg-sidebar/30 hover:bg-sidebar-accent/20 transition-colors space-y-2 group"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {task.status === "running" ? (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <PlayIcon className="w-3 h-3 text-green-600" />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
            <PauseIcon className="w-3 h-3 text-orange-600" />
          </div>
        )}
        <span className="text-xs font-medium text-sidebar-foreground">
          {task.status.toUpperCase()}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAbortTask(task.sessionId);
        }}
        disabled={isAbortPending}
        title="Abort task"
      >
        <XIcon className="w-3 h-3" />
      </Button>
    </div>

    <div className="space-y-1">
      <div className="text-xs text-sidebar-foreground/70">
        Task ID:
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCopyTaskId(task.id);
          }}
          className="ml-1 font-mono hover:text-sidebar-foreground transition-colors"
          title="Click to copy"
        >
          {task.id.slice(-8)}
        </button>
      </div>

      <div className="text-xs text-sidebar-foreground/70">
        Session:
        <span className="ml-1 font-mono text-sidebar-foreground">
          {task.sessionId.slice(-8)}
        </span>
      </div>

      {task.userMessageId && (
        <div className="text-xs text-sidebar-foreground/70">
          Message:
          <span className="ml-1 font-mono">{task.userMessageId.slice(-8)}</span>
        </div>
      )}
    </div>
  </Link>
);
