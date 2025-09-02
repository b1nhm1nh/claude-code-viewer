"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeftIcon, LoaderIcon, PauseIcon, XIcon } from "lucide-react";
import Link from "next/link";
import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { honoClient } from "../../../../../../lib/api/client";
import { firstCommandToTitle } from "../../../services/firstCommandToTitle";
import { useAliveTask } from "../hooks/useAliveTask";
import { useSession } from "../hooks/useSession";
import { ConversationList } from "./conversationList/ConversationList";
import { ResumeChat } from "./resumeChat/ResumeChat";
import { SessionSidebar } from "./sessionSidebar/SessionSidebar";

export const SessionPageContent: FC<{
  projectId: string;
  sessionId: string;
}> = ({ projectId, sessionId }) => {
  const { session, conversations, getToolResult } = useSession(
    projectId,
    sessionId,
  );

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

  const { isRunningTask, isPausedTask } = useAliveTask(sessionId);

  const [previousConversationLength, setPreviousConversationLength] =
    useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 自動スクロール処理
  useEffect(() => {
    if (isRunningTask && conversations.length !== previousConversationLength) {
      setPreviousConversationLength(conversations.length);
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [conversations, isRunningTask, previousConversationLength]);

  return (
    <div className="flex h-screen">
      <SessionSidebar currentSessionId={sessionId} projectId={projectId} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="max-w-none flex-1 overflow-y-auto"
        >
          <header className="px-3 py-3 sticky top-0 z-10 bg-background w-full">
            <Button asChild variant="ghost">
              <Link
                href={`/projects/${projectId}`}
                className="flex items-center gap-2"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to Session List
              </Link>
            </Button>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold break-all overflow-ellipsis line-clamp-2 px-5">
                  {session.meta.firstCommand !== null
                    ? firstCommandToTitle(session.meta.firstCommand)
                    : sessionId}
                </h1>
              </div>

              {isRunningTask && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <LoaderIcon className="w-4 h-4 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Conversation is in progress...
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      abortTask.mutate(sessionId);
                    }}
                  >
                    <XIcon className="w-4 h-4" />
                    Abort
                  </Button>
                </div>
              )}

              {isPausedTask && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <PauseIcon className="w-4 h-4" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Conversation is paused...
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      abortTask.mutate(sessionId);
                    }}
                  >
                    <XIcon className="w-4 h-4" />
                    Abort
                  </Button>
                </div>
              )}

              <p className="text-muted-foreground font-mono text-sm">
                Session ID: {sessionId}
              </p>
            </div>
          </header>

          <main className="w-full px-20 pb-20 relative z-5">
            <ConversationList
              conversations={conversations}
              getToolResult={getToolResult}
            />

            <ResumeChat
              projectId={projectId}
              sessionId={sessionId}
              isPausedTask={isPausedTask}
              isRunningTask={isRunningTask}
            />
          </main>
        </div>
      </div>
    </div>
  );
};
