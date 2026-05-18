import { zValidator } from "@hono/zod-validator";
import { Effect } from "effect";
import { Hono } from "hono";
import { z } from "zod";
import { AgentSessionController } from "../../core/agent-session/presentation/AgentSessionController.ts";
import { ClaudeCodeController } from "../../core/claude-code/presentation/ClaudeCodeController.ts";
import { FileSystemController } from "../../core/file-system/presentation/FileSystemController.ts";
import { GitController } from "../../core/git/presentation/GitController.ts";
import { CommitRequestSchema } from "../../core/git/schema.ts";
import { ProjectController } from "../../core/project/presentation/ProjectController.ts";
import { SessionController } from "../../core/session/presentation/SessionController.ts";
import { TerminalLauncherService } from "../../core/terminal-launcher/TerminalLauncherService.ts";
import { effectToResponse } from "../../lib/effect/toEffectResponse.ts";
import type { HonoContext } from "../app.ts";
import { getHonoRuntime } from "../runtime.ts";

const projectRoutes = Effect.gen(function* () {
  const projectController = yield* ProjectController;
  const sessionController = yield* SessionController;
  const agentSessionController = yield* AgentSessionController;
  const claudeCodeController = yield* ClaudeCodeController;
  const fileSystemController = yield* FileSystemController;
  const gitController = yield* GitController;
  const terminalLauncherService = yield* TerminalLauncherService;

  const runtime = yield* getHonoRuntime;

  return (
    new Hono<HonoContext>()
      /**
       * Projects
       */
      .get("/", async (c) => {
        const response = await effectToResponse(c, projectController.getProjects());
        return response;
      })
      .get(
        "/:projectId",
        zValidator("query", z.object({ cursor: z.string().optional() })),
        async (c) => {
          const response = await effectToResponse(
            c,
            projectController
              .getProject({
                ...c.req.param(),
                ...c.req.valid("query"),
              })
              .pipe(Effect.provide(runtime)),
          );
          return response;
        },
      )
      .post(
        "/",
        zValidator(
          "json",
          z.object({
            projectPath: z.string().min(1, "Project path is required"),
          }),
        ),
        async (c) => {
          const response = await effectToResponse(
            c,
            projectController
              .createProject({
                ...c.req.valid("json"),
              })
              .pipe(Effect.provide(runtime)),
          );
          return response;
        },
      )
      .post(
        "/:projectId/transfer-sessions",
        zValidator(
          "json",
          z.object({
            targetProjectId: z.string().min(1, "targetProjectId is required"),
            mode: z.enum(["copy", "move"]),
            conflict: z.enum(["skip", "overwrite"]).optional().default("skip"),
            sessionIds: z.array(z.string().min(1)).min(1).optional(),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const body = c.req.valid("json");
          const response = await effectToResponse(
            c,
            projectController
              .transferSessions({
                sourceProjectId: projectId,
                targetProjectId: body.targetProjectId,
                mode: body.mode,
                conflict: body.conflict,
                sessionIds: body.sessionIds,
              })
              .pipe(Effect.provide(runtime)),
          );
          return response;
        },
      )
      .get("/:projectId/latest-session", async (c) => {
        const response = await effectToResponse(
          c,
          projectController
            .getProjectLatestSession({
              ...c.req.param(),
            })
            .pipe(Effect.provide(runtime)),
        );
        return response;
      })

      /**
       * Sessions
       */
      .get("/:projectId/sessions/:sessionId", async (c) => {
        const projectId = c.req.param("projectId");
        const sessionId = c.req.param("sessionId");
        const response = await effectToResponse(
          c,
          sessionController.getSession({ projectId, sessionId }).pipe(Effect.provide(runtime)),
        );
        return response;
      })
      .get("/:projectId/sessions/:sessionId/export", async (c) => {
        const projectId = c.req.param("projectId");
        const sessionId = c.req.param("sessionId");
        const response = await effectToResponse(
          c,
          sessionController
            .exportSessionHtml({ projectId, sessionId })
            .pipe(Effect.provide(runtime)),
        );
        return response;
      })
      .delete("/:projectId/sessions/:sessionId", async (c) => {
        const projectId = c.req.param("projectId");
        const sessionId = c.req.param("sessionId");
        const response = await effectToResponse(
          c,
          sessionController.deleteSession({ projectId, sessionId }).pipe(Effect.provide(runtime)),
        );
        return response;
      })
      .get("/:projectId/sessions/:sessionId/agent-sessions", async (c) => {
        const projectId = c.req.param("projectId");
        const sessionId = c.req.param("sessionId");
        const response = await effectToResponse(
          c,
          agentSessionController.listAgentSessions({
            projectId,
            sessionId,
          }),
        );
        return response;
      })

      /**
       * agent sessions
       */
      .get(
        "/:projectId/agent-sessions/:agentId",
        zValidator("query", z.object({ sessionId: z.string().optional() })),
        async (c) => {
          const projectId = c.req.param("projectId");
          const agentId = c.req.param("agentId");
          const { sessionId } = c.req.valid("query");
          const response = await effectToResponse(
            c,
            agentSessionController.getAgentSession({
              projectId,
              agentId,
              sessionId,
            }),
          );
          return response;
        },
      )

      /**
       * claude code routes
       */
      .get("/:projectId/claude-commands", async (c) => {
        const response = await effectToResponse(
          c,
          claudeCodeController
            .getClaudeCommands({
              ...c.req.param(),
            })
            .pipe(Effect.provide(runtime)),
        );
        return response;
      })
      .get("/:projectId/mcp/list", async (c) => {
        const response = await effectToResponse(
          c,
          claudeCodeController
            .getMcpListRoute({
              ...c.req.param(),
            })
            .pipe(Effect.provide(runtime)),
        );
        return response;
      })

      /**
       * file system routes
       */
      .get(
        "/:projectId/files",
        zValidator(
          "query",
          z.object({
            filePath: z.string().min(1, "filePath is required"),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { filePath } = c.req.valid("query");
          const response = await effectToResponse(
            c,
            fileSystemController
              .getFileContentRoute({
                projectId,
                filePath,
              })
              .pipe(Effect.provide(runtime)),
          );
          return response;
        },
      )

      /**
       * git routes
       */
      .get("/:projectId/git/current-revisions", async (c) => {
        const projectId = c.req.param("projectId");
        const response = await effectToResponse(
          c,
          gitController
            .getCurrentRevisions({
              projectId,
            })
            .pipe(Effect.provide(runtime)),
        );
        return response;
      })
      .post(
        "/:projectId/git/diff",
        zValidator(
          "json",
          z.object({
            fromRef: z.string().min(1, "fromRef is required"),
            toRef: z.string().min(1, "toRef is required"),
          }),
        ),
        async (c) => {
          const projectId = c.req.param("projectId");
          const response = await effectToResponse(
            c,
            gitController
              .getGitDiff({
                projectId,
                ...c.req.valid("json"),
              })
              .pipe(Effect.provide(runtime)),
          );
          return response;
        },
      )
      .post("/:projectId/git/commit", zValidator("json", CommitRequestSchema), async (c) => {
        const projectId = c.req.param("projectId");
        const response = await effectToResponse(
          c,
          gitController
            .commitFiles({
              projectId,
              ...c.req.valid("json"),
            })
            .pipe(Effect.provide(runtime)),
        );
        return response;
      })
      .post("/:projectId/git/push", async (c) => {
        const projectId = c.req.param("projectId");
        const response = await effectToResponse(
          c,
          gitController
            .pushCommits({
              projectId,
            })
            .pipe(Effect.provide(runtime)),
        );
        return response;
      })
      .post(
        "/:projectId/git/commit-and-push",
        zValidator("json", CommitRequestSchema),
        async (c) => {
          const projectId = c.req.param("projectId");
          const response = await effectToResponse(
            c,
            gitController
              .commitAndPush({
                projectId,
                ...c.req.valid("json"),
              })
              .pipe(Effect.provide(runtime)),
          );
          return response;
        },
      )
      .get("/:projectId/git/branches", async (c) => {
        const projectId = c.req.param("projectId");
        const response = await effectToResponse(
          c,
          gitController
            .getBranches({
              projectId,
            })
            .pipe(Effect.provide(runtime)),
        );
        return response;
      })
      .post(
        "/:projectId/git/checkout",
        zValidator(
          "json",
          z.object({
            branchName: z.string().min(1, "branchName is required"),
          }),
        ),
        async (c) => {
          const projectId = c.req.param("projectId");
          const response = await effectToResponse(
            c,
            gitController
              .checkoutBranch({
                projectId,
                ...c.req.valid("json"),
              })
              .pipe(Effect.provide(runtime)),
          );
          return response;
        },
      )

      /**
       * external terminal launch
       */
      .post(
        "/:projectId/launch-terminal",
        zValidator(
          "json",
          z.object({
            terminal: z.string().optional(),
          }),
        ),
        async (c) => {
          const projectId = c.req.param("projectId");
          const { terminal } = c.req.valid("json");

          const effect = terminalLauncherService.launch({ projectId, terminal }).pipe(
            Effect.map(
              (value) =>
                ({
                  status: 200 as const,
                  response: {
                    ok: true as const,
                    terminal: value.terminal,
                    cwd: value.cwd,
                  },
                }) as const,
            ),
            Effect.catchTag("TerminalNotAllowedError", (e) =>
              Effect.succeed({
                status: 400 as const,
                response: {
                  ok: false as const,
                  error: "terminal-not-allowed" as const,
                  key: e.key,
                  reason: e.reason,
                  platform: e.platform,
                },
              }),
            ),
            Effect.catchTag("ProjectPathMissingError", (e) =>
              Effect.succeed({
                status: 404 as const,
                response: {
                  ok: false as const,
                  error: "project-path-missing" as const,
                  projectId: e.projectId,
                },
              }),
            ),
            Effect.catchTag("ProjectLookupError", (e) =>
              Effect.succeed({
                status: 404 as const,
                response: {
                  ok: false as const,
                  error: "project-lookup-failed" as const,
                  projectId: e.projectId,
                  message: e.message,
                },
              }),
            ),
            Effect.catchAll((e) =>
              Effect.succeed({
                status: 500 as const,
                response: {
                  ok: false as const,
                  error: "launch-failed" as const,
                  message: String(e),
                },
              }),
            ),
            Effect.provide(runtime),
          );

          const result = await Effect.runPromise(effect);
          return c.json(result.response, result.status);
        },
      )
  );
});

export { projectRoutes };
