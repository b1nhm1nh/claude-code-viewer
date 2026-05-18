import { Trans } from "@lingui/react";
import { useAtom } from "jotai";
import { LayoutGrid, List } from "lucide-react";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { projectListViewAtom } from "@/lib/atoms/projectListView";
import { cn } from "@/utils";

export const ProjectListViewToggle: FC = () => {
  const [view, setView] = useAtom(projectListViewAtom);

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-muted/30 p-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setView("grid")}
        className={cn(
          "h-7 px-2.5 gap-1.5",
          view === "grid"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="Grid view"
        aria-pressed={view === "grid"}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span className="text-xs">
          <Trans id="project_list.view.grid" />
        </span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setView("list")}
        className={cn(
          "h-7 px-2.5 gap-1.5",
          view === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="List view"
        aria-pressed={view === "list"}
      >
        <List className="w-3.5 h-3.5" />
        <span className="text-xs">
          <Trans id="project_list.view.list" />
        </span>
      </Button>
    </div>
  );
};
