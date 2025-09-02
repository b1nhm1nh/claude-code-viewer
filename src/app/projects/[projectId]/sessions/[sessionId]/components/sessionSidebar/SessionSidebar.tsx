"use client";

import { ListTodoIcon, MessageSquareIcon, SettingsIcon } from "lucide-react";
import { type FC, useState } from "react";
import { cn } from "@/lib/utils";
import { useProject } from "../../../../hooks/useProject";
import { SessionsTab } from "./SessionsTab";
import { SettingsTab } from "./SettingsTab";
import { TasksTab } from "./TasksTab";

export const SessionSidebar: FC<{
  currentSessionId: string;
  projectId: string;
  className?: string;
}> = ({ currentSessionId, projectId, className }) => {
  const {
    data: { sessions },
  } = useProject(projectId);
  const [activeTab, setActiveTab] = useState<"sessions" | "tasks" | "settings">(
    "sessions",
  );
  const [isExpanded, setIsExpanded] = useState(true);

  const handleTabClick = (tab: "sessions" | "tasks" | "settings") => {
    if (activeTab === tab && isExpanded) {
      // If clicking the active tab while expanded, collapse
      setIsExpanded(false);
    } else {
      // If clicking a different tab or expanding, show that tab
      setActiveTab(tab);
      setIsExpanded(true);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "sessions":
        return (
          <SessionsTab
            sessions={sessions}
            currentSessionId={currentSessionId}
            projectId={projectId}
          />
        );
      case "tasks":
        return <TasksTab projectId={projectId} />;
      case "settings":
        return <SettingsTab />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("hidden md:flex h-full", className)}>
      <div
        className={cn(
          "h-full border-r border-sidebar-border transition-all duration-300 ease-in-out flex bg-sidebar text-sidebar-foreground",
          isExpanded ? "w-72 lg:w-80" : "w-12",
        )}
      >
        {/* Vertical Icon Menu - Always Visible */}
        <div className="w-12 flex flex-col border-r border-sidebar-border bg-sidebar/50">
          <div className="flex flex-col p-2 space-y-1">
            <button
              type="button"
              onClick={() => handleTabClick("sessions")}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                activeTab === "sessions" && isExpanded
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70",
              )}
              title="Sessions"
            >
              <MessageSquareIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleTabClick("tasks")}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                activeTab === "tasks" && isExpanded
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70",
              )}
              title="Tasks"
            >
              <ListTodoIcon className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleTabClick("settings")}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                activeTab === "settings" && isExpanded
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70",
              )}
              title="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area - Only shown when expanded */}
        {isExpanded && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderContent()}
          </div>
        )}
      </div>
    </div>
  );
};
