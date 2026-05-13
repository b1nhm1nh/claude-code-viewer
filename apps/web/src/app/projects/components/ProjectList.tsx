import { formatLocaleDate } from "@ccv/shared/date/formatLocaleDate";
import { Trans } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { Copy, FolderIcon } from "lucide-react";
import { type FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfig } from "../../hooks/useConfig";
import { useProjects } from "../hooks/useProjects";
import { TransferSessionsDialog } from "./TransferSessionsDialog";

export const ProjectList: FC = () => {
  const {
    data: { projects },
  } = useProjects();
  const { config } = useConfig();
  const [transferOpenFor, setTransferOpenFor] = useState<string | null>(null);

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            <Trans id="project_list.no_projects.title" />
          </h3>
          <p className="text-muted-foreground text-center max-w-md">
            <Trans id="project_list.no_projects.description" />
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const isTransferOpen = transferOpenFor === project.id;
        return (
          <Card key={project.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-start items-start">
                <FolderIcon className="w-5 h-5 flex-shrink-0" />
                <span className="text-wrap flex-1">
                  {project.meta.projectName ?? project.claudeProjectPath}
                </span>
              </CardTitle>
              {project.meta.projectPath !== undefined && project.meta.projectPath !== "" ? (
                <CardDescription>{project.meta.projectPath}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <Trans id="project_list.last_modified" />{" "}
                {project.lastModifiedAt
                  ? formatLocaleDate(project.lastModifiedAt, {
                      locale: config.locale,
                      target: "time",
                    })
                  : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                <Trans id="project_list.messages" /> {project.meta.sessionCount}
              </p>
            </CardContent>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link to={"/projects/$projectId/session"} params={{ projectId: project.id }}>
                    <Trans id="project_list.view_conversations" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={() => setTransferOpenFor(project.id)}
                  title="Copy or move sessions to another project"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  <Trans id="project.transfer.menu_label" />
                </Button>
              </div>
            </CardContent>
            {isTransferOpen && (
              <TransferSessionsDialog
                project={project}
                open={isTransferOpen}
                onOpenChange={(next) => {
                  if (!next) setTransferOpenFor(null);
                }}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
};
