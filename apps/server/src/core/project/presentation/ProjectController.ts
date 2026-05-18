import { FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import type { ControllerResponse } from "../../../lib/effect/toEffectResponse.ts";
import type { InferEffect } from "../../../lib/effect/types.ts";
import { computeClaudeProjectFilePath } from "../../claude-code/functions/computeClaudeProjectFilePath.ts";
import { ClaudeCodeLifeCycleService } from "../../claude-code/services/ClaudeCodeLifeCycleService.ts";
import { ApplicationContext } from "../../platform/services/ApplicationContext.ts";
import { UserConfigService } from "../../platform/services/UserConfigService.ts";
import { SessionRepository } from "../../session/infrastructure/SessionRepository.ts";
import { encodeProjectId } from "../functions/id.ts";
import { ProjectRepository } from "../infrastructure/ProjectRepository.ts";
import {
  SessionTransferService,
  type TransferConflict,
  type TransferMode,
} from "../services/SessionTransferService.ts";

const LayerImpl = Effect.gen(function* () {
  const projectRepository = yield* ProjectRepository;
  const claudeCodeLifeCycleService = yield* ClaudeCodeLifeCycleService;
  const userConfigService = yield* UserConfigService;
  const sessionRepository = yield* SessionRepository;
  const context = yield* ApplicationContext;
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sessionTransferService = yield* SessionTransferService;

  const getProjects = () =>
    Effect.gen(function* () {
      const { projects } = yield* projectRepository.getProjects();
      return {
        status: 200,
        response: { projects },
      } as const satisfies ControllerResponse;
    });

  const getProject = (options: { projectId: string; cursor?: string }) =>
    Effect.gen(function* () {
      const { projectId, cursor } = options;

      const userConfig = yield* userConfigService.getUserConfig();

      const { project } = yield* projectRepository.getProject(projectId);
      const { sessions } = yield* sessionRepository.getSessions(projectId, {
        cursor,
      });

      let filteredSessions = sessions;

      // Filter sessions based on hideNoUserMessageSession setting
      if (userConfig.hideNoUserMessageSession) {
        filteredSessions = filteredSessions.filter((session) => {
          return session.meta.firstUserMessage !== null;
        });
      }

      // Unify sessions with same title if unifySameTitleSession is enabled
      if (userConfig.unifySameTitleSession) {
        const sessionMap = new Map<string, (typeof filteredSessions)[0]>();

        for (const session of filteredSessions) {
          // Generate title for comparison
          const title =
            session.meta.firstUserMessage !== null
              ? (() => {
                  const cmd = session.meta.firstUserMessage;
                  switch (cmd.kind) {
                    case "command":
                      return cmd.commandArgs === undefined
                        ? cmd.commandName
                        : `${cmd.commandName} ${cmd.commandArgs}`;
                    case "local-command":
                      return cmd.stdout;
                    case "text":
                      return cmd.content;
                    default:
                      return session.id;
                  }
                })()
              : session.id;

          const existingSession = sessionMap.get(title);
          if (existingSession !== undefined) {
            // Keep the session with the latest modification date
            if (session.lastModifiedAt > existingSession.lastModifiedAt) {
              sessionMap.set(title, session);
            }
          } else {
            sessionMap.set(title, session);
          }
        }

        filteredSessions = Array.from(sessionMap.values());
      }

      const hasMore = sessions.length >= 20;
      return {
        status: 200,
        response: {
          project,
          sessions: filteredSessions,
          nextCursor: hasMore ? sessions.at(-1)?.id : undefined,
        },
      } as const satisfies ControllerResponse;
    });

  const getProjectLatestSession = (options: { projectId: string }) =>
    Effect.gen(function* () {
      const { projectId } = options;
      const { sessions } = yield* sessionRepository.getSessions(projectId, {
        maxCount: 1,
      });

      return {
        status: 200,
        response: {
          latestSession: sessions[0] ?? null,
        },
      } as const satisfies ControllerResponse;
    });

  const createProject = (options: { projectPath: string }) =>
    Effect.gen(function* () {
      const { projectPath } = options;

      // No project validation needed - startTask will create a new project
      // if it doesn't exist when running /init command
      const claudeProjectFilePath = yield* computeClaudeProjectFilePath({
        projectPath,
        claudeProjectsDirPath: (yield* context.claudeCodePaths).claudeProjectsDirPath,
      });
      const projectId = encodeProjectId(claudeProjectFilePath);

      // Check if CLAUDE.md exists in the project directory
      const claudeMdPath = path.join(projectPath, "CLAUDE.md");
      const claudeMdExists = yield* fileSystem.exists(claudeMdPath);

      const result = yield* claudeCodeLifeCycleService.startSessionProcess({
        projectId,
        cwd: projectPath,
        sessionId: crypto.randomUUID(),
        resume: false,
        input: {
          text: claudeMdExists ? "describe this project" : "/init",
        },
      });

      const { sessionId } = result;

      return {
        status: 201,
        response: {
          projectId,
          sessionId,
        },
      } as const satisfies ControllerResponse;
    });

  const transferSessions = (options: {
    sourceProjectId: string;
    targetProjectId: string;
    mode: TransferMode;
    conflict: TransferConflict;
    sessionIds?: readonly string[];
  }) =>
    Effect.gen(function* () {
      const either = yield* Effect.either(sessionTransferService.transfer(options));

      if (either._tag === "Left") {
        const error = either.left;
        const status: 400 | 404 = error.code === "PROJECT_NOT_FOUND" ? 404 : 400;
        return {
          status,
          response: {
            code: error.code,
            message: error.message,
          },
        } as const satisfies ControllerResponse;
      }

      return {
        status: 200,
        response: either.right,
      } as const satisfies ControllerResponse;
    });

  return {
    getProjects,
    getProject,
    getProjectLatestSession,
    createProject,
    transferSessions,
  };
});

export type IProjectController = InferEffect<typeof LayerImpl>;
export class ProjectController extends Context.Tag("ProjectController")<
  ProjectController,
  IProjectController
>() {
  static Live = Layer.effect(this, LayerImpl);
}
