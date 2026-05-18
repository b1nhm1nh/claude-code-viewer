import { formatLocaleDate } from "@ccv/shared/date/formatLocaleDate";
import type { SupportedLocale } from "@ccv/shared/i18n/schema";
import { Trans } from "@lingui/react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, FolderIcon, TerminalIcon } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { useConfig } from "@/app/hooks/useConfig";
import { useLaunchTerminal } from "@/app/hooks/useLaunchTerminal";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format/formatBytes";
import { cn } from "@/utils";
import { TransferSessionsDialog } from "./TransferSessionsDialog";

type ProjectItem = {
  id: string;
  claudeProjectPath: string;
  lastModifiedAt: string;
  createdAt: string | null;
  totalSizeBytes: number;
  meta: {
    projectName: string | null;
    projectPath: string | null;
    sessionCount: number;
  };
};

type SortKey = "name" | "created" | "lastModified" | "messages" | "size";
type SortDir = "asc" | "desc";

type Props = {
  projects: ProjectItem[];
};

const displayName = (p: ProjectItem) => p.meta.projectName ?? p.claudeProjectPath;

const dateOrZero = (iso: string | null): number =>
  iso !== null && iso !== "" ? new Date(iso).getTime() : 0;

const compareProjects = (a: ProjectItem, b: ProjectItem, sortBy: SortKey, dir: SortDir) => {
  const sign = dir === "asc" ? 1 : -1;
  switch (sortBy) {
    case "name":
      return displayName(a).localeCompare(displayName(b)) * sign;
    case "created":
      return (dateOrZero(a.createdAt) - dateOrZero(b.createdAt)) * sign;
    case "lastModified":
      return (new Date(a.lastModifiedAt).getTime() - new Date(b.lastModifiedAt).getTime()) * sign;
    case "messages":
      return (a.meta.sessionCount - b.meta.sessionCount) * sign;
    case "size":
      return (a.totalSizeBytes - b.totalSizeBytes) * sign;
    default:
      return 0;
  }
};

const SortIcon: FC<{ active: boolean; dir: SortDir }> = ({ active, dir }) => {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
};

type SortableHeaderProps = {
  label: React.ReactNode;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  align?: "left" | "right";
  onClick: (key: SortKey) => void;
};

const SortableHeader: FC<SortableHeaderProps> = ({
  label,
  sortKey,
  active,
  dir,
  align = "left",
  onClick,
}) => (
  <th
    className={cn(
      "px-3 py-2 text-xs font-medium text-muted-foreground",
      align === "right" ? "text-right" : "text-left",
    )}
    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
  >
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
        align === "right" && "justify-end w-full",
      )}
    >
      {label}
      <SortIcon active={active} dir={dir} />
    </button>
  </th>
);

const ProjectRow: FC<{ project: ProjectItem; locale: SupportedLocale }> = ({ project, locale }) => {
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const launchTerminal = useLaunchTerminal(project.id);

  return (
    <tr className="border-b border-border/40 hover:bg-muted/30">
      <td className="px-3 py-2">
        <div className="flex items-start gap-2 min-w-0">
          <FolderIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{displayName(project)}</div>
            {project.meta.projectPath !== null && project.meta.projectPath !== "" ? (
              <div className="text-xs text-muted-foreground truncate">
                {project.meta.projectPath}
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
        {project.createdAt !== null && project.createdAt !== ""
          ? formatLocaleDate(project.createdAt, { locale, target: "time" })
          : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
        {project.lastModifiedAt !== ""
          ? formatLocaleDate(project.lastModifiedAt, { locale, target: "time" })
          : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-right text-muted-foreground">
        {project.meta.sessionCount}
      </td>
      <td className="px-3 py-2 text-xs text-right text-muted-foreground whitespace-nowrap">
        {formatBytes(project.totalSizeBytes)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          <Button asChild size="sm" variant="default" className="h-7 px-2 text-xs">
            <Link to={"/projects/$projectId/session"} params={{ projectId: project.id }}>
              <Trans id="project_list.view_conversations" />
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => setIsTransferOpen(true)}
          >
            <Copy className="w-3 h-3 mr-1" />
            <Trans id="project.transfer.menu_label" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => launchTerminal.mutate()}
            disabled={launchTerminal.isPending}
          >
            <TerminalIcon className="w-3 h-3 mr-1" />
            <Trans id="project_list.action.terminal" />
          </Button>
        </div>
        {isTransferOpen && (
          <TransferSessionsDialog
            project={project}
            open={isTransferOpen}
            onOpenChange={(next) => {
              if (!next) setIsTransferOpen(false);
            }}
          />
        )}
      </td>
    </tr>
  );
};

export const ProjectListTable: FC<Props> = ({ projects }) => {
  const { config } = useConfig();
  const [sortBy, setSortBy] = useState<SortKey>("lastModified");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(
    () => [...projects].sort((a, b) => compareProjects(a, b, sortBy, sortDir)),
    [projects, sortBy, sortDir],
  );

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-b border-border">
          <tr>
            <SortableHeader
              label={<Trans id="project_list.column.project" />}
              sortKey="name"
              active={sortBy === "name"}
              dir={sortDir}
              onClick={handleSort}
            />
            <SortableHeader
              label={<Trans id="project_list.column.created" />}
              sortKey="created"
              active={sortBy === "created"}
              dir={sortDir}
              onClick={handleSort}
            />
            <SortableHeader
              label={<Trans id="project_list.column.last_update" />}
              sortKey="lastModified"
              active={sortBy === "lastModified"}
              dir={sortDir}
              onClick={handleSort}
            />
            <SortableHeader
              label={<Trans id="project_list.column.messages" />}
              sortKey="messages"
              active={sortBy === "messages"}
              dir={sortDir}
              align="right"
              onClick={handleSort}
            />
            <SortableHeader
              label={<Trans id="project_list.column.size" />}
              sortKey="size"
              active={sortBy === "size"}
              dir={sortDir}
              align="right"
              onClick={handleSort}
            />
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
              <Trans id="project_list.column.actions" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((project) => (
            <ProjectRow key={project.id} project={project} locale={config.locale} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
