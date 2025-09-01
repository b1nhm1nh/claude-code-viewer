"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  FolderIcon,
  MessageSquareIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { configQueryConfig, useConfig } from "../../../hooks/useConfig";
import { projectQueryConfig, useProject } from "../hooks/useProject";
import { firstCommandToTitle } from "../services/firstCommandToTitle";
import { NewChatModal } from "./newChat/NewChatModal";

export const ProjectPageContent = ({ projectId }: { projectId: string }) => {
  const checkboxId = useId();
  const {
    data: { project, sessions },
  } = useProject(projectId);
  const { config, updateConfig } = useConfig();
  const queryClient = useQueryClient();

  // biome-ignore lint/correctness/useExhaustiveDependencies: invalidate when config changed
  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: projectQueryConfig(projectId).queryKey,
    });
  }, [config.hideNoUserMessageSession]);

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/projects" className="flex items-center gap-2">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Projects
          </Link>
        </Button>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FolderIcon className="w-6 h-6" />
            <h1 className="text-3xl font-bold">
              {project.meta.projectPath ?? project.claudeProjectPath}
            </h1>
          </div>
          <NewChatModal
            projectId={projectId}
            trigger={
              <Button size="lg" className="gap-2">
                <PlusIcon className="w-5 h-5" />
                Start New Chat
              </Button>
            }
          />
        </div>
        <p className="text-muted-foreground font-mono text-sm">
          History File: {project.claudeProjectPath ?? "unknown"}
        </p>
      </header>

      <main>
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Conversation Sessions{" "}
            {sessions.length > 0 ? `(${sessions.length})` : ""}
          </h2>

          {/* Filter Controls */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={checkboxId}
                checked={config?.hideNoUserMessageSession}
                onCheckedChange={async () => {
                  updateConfig({
                    ...config,
                    hideNoUserMessageSession: !config?.hideNoUserMessageSession,
                  });
                  await queryClient.invalidateQueries({
                    queryKey: configQueryConfig.queryKey,
                  });
                }}
              />
              <label
                htmlFor={checkboxId}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Hide sessions without user messages
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Only show sessions that contain user commands or messages
            </p>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquareIcon className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No sessions found</h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  No conversation sessions found for this project. Start a
                  conversation with Claude Code in this project to create
                  sessions.
                </p>
                <NewChatModal
                  projectId={projectId}
                  trigger={
                    <Button size="lg" className="gap-2">
                      <PlusIcon className="w-5 h-5" />
                      Start First Chat
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="break-all overflow-ellipsis line-clamp-2 text-xl">
                        {session.meta.firstCommand !== null
                          ? firstCommandToTitle(session.meta.firstCommand)
                          : session.id}
                      </span>
                    </CardTitle>
                    <CardDescription className="font-mono text-xs">
                      {session.id}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {session.meta.messageCount} messages
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Last modified:{" "}
                      {session.meta.lastModifiedAt
                        ? new Date(
                            session.meta.lastModifiedAt,
                          ).toLocaleDateString()
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {session.jsonlFilePath}
                    </p>
                  </CardContent>
                  <CardContent className="pt-0">
                    <Button asChild className="w-full">
                      <Link
                        href={`/projects/${projectId}/sessions/${encodeURIComponent(
                          session.id,
                        )}`}
                      >
                        View Session
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
