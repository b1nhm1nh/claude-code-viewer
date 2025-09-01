"use client";

import { MessageSquareIcon, PanelLeftIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { type FC, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Session } from "../../../../../../../server/service/types";
import { NewChatModal } from "../../../../components/newChat/NewChatModal";
import { useProject } from "../../../../hooks/useProject";
import { firstCommandToTitle } from "../../../../services/firstCommandToTitle";

const SidebarContent: FC<{
  sessions: Session[];
  currentSessionId: string;
  projectId: string;
}> = ({ sessions, currentSessionId, projectId }) => (
  <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
    <div className="border-b border-sidebar-border p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-lg">Sessions</h2>
        <NewChatModal
          projectId={projectId}
          trigger={
            <Button size="sm" variant="outline" className="gap-1.5 mr-5">
              <PlusIcon className="w-3.5 h-3.5" />
              New
            </Button>
          }
        />
      </div>
      <p className="text-xs text-sidebar-foreground/70">
        {sessions.length} total
      </p>
    </div>

    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
      {sessions.map((session) => {
        const isActive = session.id === currentSessionId;
        const title =
          session.meta.firstCommand !== null
            ? firstCommandToTitle(session.meta.firstCommand)
            : session.id;

        return (
          <Link
            key={session.id}
            href={`/projects/${projectId}/sessions/${encodeURIComponent(
              session.id,
            )}`}
            className={cn(
              "block rounded-lg p-2.5 transition-all duration-200 hover:bg-blue-50/60 hover:border-blue-300/60 hover:shadow-sm border border-sidebar-border/40 bg-sidebar/30",
              isActive &&
                "bg-blue-100 border-blue-400 shadow-md ring-1 ring-blue-200/50 hover:bg-blue-100 hover:border-blue-400",
            )}
          >
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium line-clamp-2 leading-tight text-sidebar-foreground">
                {title}
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-sidebar-foreground/70">
                  <MessageSquareIcon className="w-3 h-3" />
                  <span>{session.meta.messageCount}</span>
                </div>
                {session.meta.lastModifiedAt && (
                  <span className="text-xs text-sidebar-foreground/60">
                    {new Date(session.meta.lastModifiedAt).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  </div>
);

export const SessionSidebar: FC<{
  currentSessionId: string;
  projectId: string;
  className?: string;
}> = ({ currentSessionId, projectId, className }) => {
  const {
    data: { sessions },
  } = useProject(projectId);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <Collapsible
      open={!isCollapsed}
      onOpenChange={(open) => setIsCollapsed(!open)}
      className={cn("hidden md:flex h-full", className)}
    >
      <div className="relative h-full">
        <div
          className={cn(
            "h-full border-r border-sidebar-border transition-all duration-300 ease-in-out",
            isCollapsed ? "w-12" : "w-72 lg:w-80",
          )}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-4 z-10 bg-background border border-sidebar-border shadow-sm"
            >
              <PanelLeftIcon
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  isCollapsed && "rotate-180",
                )}
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="h-full data-[state=closed]:animate-slide-out-to-left data-[state=open]:animate-slide-in-from-left">
            <SidebarContent
              sessions={sessions}
              currentSessionId={currentSessionId}
              projectId={projectId}
            />
          </CollapsibleContent>

          {isCollapsed && (
            <div className="h-full bg-sidebar border-r border-sidebar-border flex flex-col items-center pt-16">
              <MessageSquareIcon className="w-5 h-5 text-sidebar-foreground/70" />
            </div>
          )}
        </div>
      </div>
    </Collapsible>
  );
};
