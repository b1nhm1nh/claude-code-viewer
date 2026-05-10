import { useMutation, useQueryClient } from "@tanstack/react-query";
import { honoClient } from "@/web/lib/api/client";
import { projectDetailQuery, projectListQuery } from "@/web/lib/api/queries";

type TransferInput = {
  sourceProjectId: string;
  targetProjectId: string;
  mode: "copy" | "move";
  conflict: "skip" | "overwrite";
};

export const useTransferSessions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TransferInput) => {
      const response = await honoClient.api.projects[":projectId"]["transfer-sessions"].$post({
        param: { projectId: input.sourceProjectId },
        json: {
          targetProjectId: input.targetProjectId,
          mode: input.mode,
          conflict: input.conflict,
        },
      });

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body !== null &&
          typeof body === "object" &&
          "message" in body &&
          typeof body.message === "string"
            ? body.message
            : `Transfer failed: ${response.statusText}`;
        throw new Error(message);
      }

      return await response.json();
    },

    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: projectListQuery.queryKey });
      void queryClient.invalidateQueries({
        queryKey: projectDetailQuery(vars.sourceProjectId).queryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: projectDetailQuery(vars.targetProjectId).queryKey,
      });
    },
  });
};
