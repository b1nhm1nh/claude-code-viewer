import { ProjectRepository } from "@ccv/server/core/project/infrastructure/ProjectRepository";
import { Effect, Layer } from "effect";

export const testProjectRepositoryLayer = (options?: {
  projects?: Array<{
    id: string;
    claudeProjectPath: string;
    lastModifiedAt: Date;
    createdAt: Date | null;
    totalSizeBytes: number;
    meta: {
      projectName: string | null;
      projectPath: string | null;
      sessionCount: number;
    };
  }>;
}) => {
  const { projects = [] } = options ?? {};

  return Layer.mock(ProjectRepository, {
    getProjects: () => Effect.succeed({ projects }),
    getProject: (projectId) =>
      Effect.sync(() => {
        const project = projects.find((p) => p.id === projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        return {
          project: project,
        };
      }),
  });
};
