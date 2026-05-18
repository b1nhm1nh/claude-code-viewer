import { useLingui } from "@lingui/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfig } from "@/app/hooks/useConfig";
import { honoClient } from "@/lib/api/client";

export const useLaunchTerminal = (projectId: string) => {
  const { i18n } = useLingui();
  const { config } = useConfig();

  return useMutation({
    mutationFn: async () => {
      const response = await honoClient.api.projects[":projectId"]["launch-terminal"].$post({
        param: { projectId },
        json: { terminal: config?.externalTerminal },
      });
      const body = (await response.json()) as { ok: boolean; error?: string; terminal?: string };
      if (!response.ok || body.ok !== true) {
        throw new Error(body.error ?? `Launch failed (${response.status})`);
      }
      return body;
    },
    onSuccess: (body) => {
      if (body.terminal !== undefined) {
        toast.success(
          i18n._({
            id: "control.launch_terminal.success",
            message: "Launched {terminal}",
            values: { terminal: body.terminal },
          }),
        );
      }
    },
    onError: (err: Error) => {
      toast.error(
        i18n._({
          id: "control.launch_terminal.error",
          message: "Failed to launch terminal: {message}",
          values: { message: err.message },
        }),
      );
    },
  });
};
