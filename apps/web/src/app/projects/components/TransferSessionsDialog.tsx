import { Trans, useLingui } from "@lingui/react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/utils";
import { useProjects } from "../hooks/useProjects";
import { useTransferSessions } from "../hooks/useTransferSessions";

type Project = {
  id: string;
  claudeProjectPath: string;
  meta: {
    projectName: string | null;
    projectPath: string | null;
  };
};

type Props = {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const TransferSessionsDialog: FC<Props> = ({ project, open, onOpenChange }) => {
  const { i18n } = useLingui();
  const {
    data: { projects },
  } = useProjects();
  const transferMutation = useTransferSessions();

  const [targetId, setTargetId] = useState<string>("");
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [conflict, setConflict] = useState<"skip" | "overwrite">("skip");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [moveConfirmed, setMoveConfirmed] = useState(false);

  const targetProjects = useMemo(
    () => projects.filter((p) => p.id !== project.id),
    [projects, project.id],
  );

  const targetProject = targetProjects.find((p) => p.id === targetId);

  const projectLabel = (p: Project) =>
    p.meta.projectName ?? p.meta.projectPath ?? p.claudeProjectPath;

  const reset = () => {
    setTargetId("");
    setMode("copy");
    setConflict("skip");
    setMoveConfirmed(false);
    setComboboxOpen(false);
  };

  const handleSubmit = () => {
    if (targetId === "") return;
    transferMutation.mutate(
      {
        sourceProjectId: project.id,
        targetProjectId: targetId,
        mode,
        conflict,
      },
      {
        onSuccess: (data) => {
          const parts: string[] = [`Transferred ${data.transferred.length} sessions`];
          if (data.skipped.length > 0) parts.push(`skipped ${data.skipped.length}`);
          if (data.failed.length > 0) parts.push(`failed ${data.failed.length}`);
          toast.success(parts.join(", "));
          reset();
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Transfer failed");
        },
      },
    );
  };

  const submitDisabled =
    targetId === "" || transferMutation.isPending || (mode === "move" && !moveConfirmed);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[92vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            <Trans id="project.transfer.dialog.title" />
          </DialogTitle>
          <DialogDescription>
            <Trans id="project.transfer.dialog.description" />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>
              <Trans id="project.transfer.source_label" />
            </Label>
            <div className="text-sm text-muted-foreground truncate">{projectLabel(project)}</div>
          </div>

          <div className="space-y-2">
            <Label>
              <Trans id="project.transfer.target_label" />
            </Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between"
                >
                  <span className="truncate">
                    {targetProject !== undefined ? (
                      projectLabel(targetProject)
                    ) : (
                      <span className="text-muted-foreground">
                        <Trans id="project.transfer.target_placeholder" />
                      </span>
                    )}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder={i18n._({ id: "project.transfer.target_search" })} />
                  <CommandList>
                    <CommandEmpty>
                      <Trans id="project.transfer.target_empty" />
                    </CommandEmpty>
                    <CommandGroup>
                      {targetProjects.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${projectLabel(p)} ${p.id}`}
                          onSelect={() => {
                            setTargetId(p.id);
                            setComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              targetId === p.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate" title={projectLabel(p)}>
                            {projectLabel(p)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>
              <Trans id="project.transfer.mode_label" />
            </Label>
            <div className="inline-flex rounded-md border p-1 bg-muted">
              <Button
                type="button"
                size="sm"
                variant={mode === "copy" ? "default" : "ghost"}
                onClick={() => {
                  setMode("copy");
                  setMoveConfirmed(false);
                }}
              >
                <Trans id="project.transfer.mode.copy" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "move" ? "default" : "ghost"}
                onClick={() => setMode("move")}
              >
                <Trans id="project.transfer.mode.move" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              <Trans id="project.transfer.conflict_label" />
            </Label>
            <div className="inline-flex rounded-md border p-1 bg-muted">
              <Button
                type="button"
                size="sm"
                variant={conflict === "skip" ? "default" : "ghost"}
                onClick={() => setConflict("skip")}
              >
                <Trans id="project.transfer.conflict.skip" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={conflict === "overwrite" ? "default" : "ghost"}
                onClick={() => setConflict("overwrite")}
              >
                <Trans id="project.transfer.conflict.overwrite" />
              </Button>
            </div>
          </div>

          {mode === "move" && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm space-y-2">
              <p className="text-destructive font-medium">
                <Trans id="project.transfer.move_warning" />
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={moveConfirmed}
                  onChange={(e) => setMoveConfirmed(e.target.checked)}
                />
                <span>
                  <Trans id="project.transfer.move_confirm" />
                </span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <Trans id="common.action.cancel" />
          </Button>
          <Button onClick={handleSubmit} disabled={submitDisabled}>
            {transferMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <Trans id="project.transfer.action.transferring" />
              </>
            ) : (
              <Trans id="project.transfer.action.submit" />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
