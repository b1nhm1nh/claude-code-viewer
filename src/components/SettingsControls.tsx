"use client";

import { useQueryClient } from "@tanstack/react-query";
import { type FC, useId } from "react";
import { configQueryConfig, useConfig } from "@/app/hooks/useConfig";
import { Checkbox } from "@/components/ui/checkbox";

interface SettingsControlsProps {
  showLabels?: boolean;
  showDescriptions?: boolean;
  className?: string;
  onConfigChange?: () => void;
}

export const SettingsControls: FC<SettingsControlsProps> = ({
  showLabels = true,
  showDescriptions = true,
  className = "",
  onConfigChange,
}: SettingsControlsProps) => {
  const checkboxId = useId();
  const { config, updateConfig } = useConfig();
  const queryClient = useQueryClient();

  const handleHideNoUserMessageChange = async () => {
    const newConfig = {
      ...config,
      hideNoUserMessageSession: !config?.hideNoUserMessageSession,
    };
    updateConfig(newConfig);
    await queryClient.invalidateQueries({
      queryKey: configQueryConfig.queryKey,
    });
    await queryClient.invalidateQueries({
      queryKey: ["projects"],
    });
    onConfigChange?.();
  };

  const handleUnifySameTitleChange = async () => {
    const newConfig = {
      ...config,
      unifySameTitleSession: !config?.unifySameTitleSession,
    };
    updateConfig(newConfig);
    await queryClient.invalidateQueries({
      queryKey: configQueryConfig.queryKey,
    });
    await queryClient.invalidateQueries({
      queryKey: ["projects"],
    });
    onConfigChange?.();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id={checkboxId}
          checked={config?.hideNoUserMessageSession}
          onCheckedChange={handleHideNoUserMessageChange}
        />
        {showLabels && (
          <label
            htmlFor={checkboxId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Hide sessions without user messages
          </label>
        )}
      </div>
      {showDescriptions && (
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          Only show sessions that contain user commands or messages
        </p>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id={`${checkboxId}-unify`}
          checked={config?.unifySameTitleSession}
          onCheckedChange={handleUnifySameTitleChange}
        />
        {showLabels && (
          <label
            htmlFor={`${checkboxId}-unify`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Unify sessions with same title
          </label>
        )}
      </div>
      {showDescriptions && (
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          Show only the latest session when multiple sessions have the same
          title
        </p>
      )}
    </div>
  );
};
