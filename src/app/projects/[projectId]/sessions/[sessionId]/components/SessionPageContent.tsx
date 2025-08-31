"use client";

import { ArrowLeftIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { firstCommandToTitle } from "../../../services/firstCommandToTitle";
import { useSession } from "../hooks/useSession";
import { ConversationList } from "./conversationList/ConversationList";
import { SessionSidebar } from "./sessionSidebar/SessionSidebar";

export const SessionPageContent: FC<{
  projectId: string;
  sessionId: string;
}> = ({ projectId, sessionId }) => {
  const { session, conversations, getToolResult } = useSession(
    projectId,
    sessionId,
  );

  return (
    <div className="flex h-screen">
      <SessionSidebar currentSessionId={sessionId} projectId={projectId} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="max-w-none px-6 md:px-8 py-6 md:py-8 flex-1 overflow-y-auto">
          <header className="mb-8">
            <Button asChild variant="ghost" className="mb-4">
              <Link
                href={`/projects/${projectId}`}
                className="flex items-center gap-2"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back to Session List
              </Link>
            </Button>

            <div className="flex items-center gap-3 mb-2">
              <MessageSquareIcon className="w-6 h-6" />
              <h1 className="text-3xl font-bold break-all overflow-ellipsis line-clamp-2">
                {session.meta.firstCommand !== null
                  ? firstCommandToTitle(session.meta.firstCommand)
                  : sessionId}
              </h1>
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              Session ID: {sessionId}
            </p>
          </header>

          <main className="w-full px-20">
            <ConversationList
              conversations={conversations}
              getToolResult={getToolResult}
            />
          </main>
        </div>
      </div>
    </div>
  );
};
