import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { zValidator } from "@hono/zod-validator";
import { setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { configSchema } from "../config/config";
import { ClaudeCodeTaskController } from "../service/claude-code/ClaudeCodeTaskController";
import { getFileWatcher } from "../service/events/fileWatcher";
import { sseEvent } from "../service/events/sseEvent";
import type { WatcherEvent } from "../service/events/types";
import { getProject } from "../service/project/getProject";
import { getProjects } from "../service/project/getProjects";
import { getSession } from "../service/session/getSession";
import { getSessions } from "../service/session/getSessions";
import type { HonoAppType } from "./app";
import { configMiddleware } from "./middleware/config.middleware";

export const routes = (app: HonoAppType) => {
  const taskController = new ClaudeCodeTaskController();

  return (
    app
      // middleware
      .use(configMiddleware)

      // routes
      .get("/config", async (c) => {
        return c.json({
          config: c.get("config"),
        });
      })

      .put("/config", zValidator("json", configSchema), async (c) => {
        const { ...config } = c.req.valid("json");

        setCookie(c, "ccv-config", JSON.stringify(config));

        return c.json({
          config,
        });
      })

      .get("/projects", async (c) => {
        const { projects } = await getProjects();
        return c.json({ projects });
      })

      .get("/projects/:projectId", async (c) => {
        const { projectId } = c.req.param();

        const [{ project }, { sessions }] = await Promise.all([
          getProject(projectId),
          getSessions(projectId).then(({ sessions }) => ({
            sessions: sessions.filter((session) => {
              if (c.get("config").hideNoUserMessageSession) {
                return session.meta.firstCommand !== null;
              }
              return true;
            }),
          })),
        ] as const);

        return c.json({ project, sessions });
      })

      .get("/projects/:projectId/sessions/:sessionId", async (c) => {
        const { projectId, sessionId } = c.req.param();
        const { session } = await getSession(projectId, sessionId);
        return c.json({ session });
      })

      .get("/projects/:projectId/claude-commands", async (c) => {
        const { projectId } = c.req.param();
        const { project } = await getProject(projectId);

        const [globalCommands, projectCommands] = await Promise.allSettled([
          readdir(resolve(homedir(), ".claude", "commands"), {
            withFileTypes: true,
          }).then((dirents) =>
            dirents
              .filter((d) => d.isFile() && d.name.endsWith(".md"))
              .map((d) => d.name.replace(/\.md$/, "")),
          ),
          project.meta.projectPath !== null
            ? readdir(
                resolve(project.meta.projectPath, ".claude", "commands"),
                {
                  withFileTypes: true,
                },
              ).then((dirents) =>
                dirents
                  .filter((d) => d.isFile() && d.name.endsWith(".md"))
                  .map((d) => d.name.replace(/\.md$/, "")),
              )
            : [],
        ]);

        return c.json({
          globalCommands:
            globalCommands.status === "fulfilled" ? globalCommands.value : [],
          projectCommands:
            projectCommands.status === "fulfilled" ? projectCommands.value : [],
        });
      })

      .post(
        "/projects/:projectId/new-session",
        zValidator(
          "json",
          z.object({
            message: z.string(),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { message } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (project.meta.projectPath === null) {
            return c.json({ error: "Project path not found" }, 400);
          }

          const task = await taskController.createTask({
            projectId,
            cwd: project.meta.projectPath,
            message,
          });

          const { nextSessionId, userMessageId } =
            await taskController.startTask(task.id);
          return c.json({ taskId: task.id, nextSessionId, userMessageId });
        },
      )

      .post(
        "/projects/:projectId/sessions/:sessionId/resume",
        zValidator(
          "json",
          z.object({
            resumeMessage: z.string(),
          }),
        ),
        async (c) => {
          const { projectId, sessionId } = c.req.param();
          const { resumeMessage } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (project.meta.projectPath === null) {
            return c.json({ error: "Project path not found" }, 400);
          }

          const task = await taskController.createTask({
            projectId,
            sessionId,
            cwd: project.meta.projectPath,
            message: resumeMessage,
          });

          const { nextSessionId, userMessageId } =
            await taskController.startTask(task.id);
          return c.json({ taskId: task.id, nextSessionId, userMessageId });
        },
      )

      .get("/tasks/running", async (c) => {
        return c.json({ runningTasks: taskController.runningTasks });
      })

      .get("/events/state_changes", async (c) => {
        return streamSSE(
          c,
          async (stream) => {
            const fileWatcher = getFileWatcher();
            let isConnected = true;
            let eventId = 0;

            // ハートビート設定
            const heartbeat = setInterval(() => {
              if (isConnected) {
                stream
                  .writeSSE({
                    data: sseEvent({
                      type: "heartbeat",
                      timestamp: new Date().toISOString(),
                    }),
                    event: "heartbeat",
                    id: String(eventId++),
                  })
                  .catch(() => {
                    console.warn("Failed to write SSE event");
                    isConnected = false;
                    onConnectionClosed();
                  });
              }
            }, 30 * 1000);

            // connection handling
            const abortController = new AbortController();
            let connectionResolve: ((value: undefined) => void) | undefined;
            const connectionPromise = new Promise<undefined>((resolve) => {
              connectionResolve = resolve;
            });

            const onConnectionClosed = () => {
              isConnected = false;
              connectionResolve?.(undefined);
              abortController.abort();
              clearInterval(heartbeat);
            };

            // 接続終了時のクリーンアップ
            stream.onAbort(() => {
              console.log("SSE connection aborted");
              onConnectionClosed();
            });

            // イベントリスナーを登録
            console.log("Registering SSE event listeners");
            fileWatcher.on("project_changed", async (event: WatcherEvent) => {
              if (!isConnected) {
                return;
              }

              if (event.eventType !== "project_changed") {
                return;
              }

              await stream
                .writeSSE({
                  data: sseEvent({
                    type: event.eventType,
                    ...event.data,
                  }),
                  event: event.eventType,
                  id: String(eventId++),
                })
                .catch(() => {
                  console.warn("Failed to write SSE event");
                  onConnectionClosed();
                });
            });
            fileWatcher.on("session_changed", async (event: WatcherEvent) => {
              if (!isConnected) {
                return;
              }

              await stream
                .writeSSE({
                  data: sseEvent({
                    ...event.data,
                    type: event.eventType,
                  }),
                  event: event.eventType,
                  id: String(eventId++),
                })
                .catch(() => {
                  onConnectionClosed();
                });
            });

            // 初期接続確認メッセージ
            await stream.writeSSE({
              data: sseEvent({
                type: "connected",
                message: "SSE connection established",
                timestamp: new Date().toISOString(),
              }),
              event: "connected",
              id: String(eventId++),
            });

            await connectionPromise;
          },
          async (err, stream) => {
            console.error("Streaming error:", err);
            await stream.write("エラーが発生しました。");
          },
        );
      })
  );
};

export type RouteType = ReturnType<typeof routes>;
