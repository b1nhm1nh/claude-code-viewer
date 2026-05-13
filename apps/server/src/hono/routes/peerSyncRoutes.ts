import { Effect, Runtime } from "effect";
import { Hono } from "hono";
import { PeerSyncService } from "../../core/peer-sync/services/PeerSyncService.ts";
import type { HonoContext } from "../app.ts";
import { createPeerSyncAuthMiddleware } from "../middleware/peerSyncAuth.middleware.ts";
import { getHonoRuntime } from "../runtime.ts";

export const peerSyncRoutes = Effect.gen(function* () {
  const runtime = yield* getHonoRuntime;
  const peerSyncAuth = yield* createPeerSyncAuthMiddleware();
  const runPromise = Runtime.runPromise(runtime);

  return new Hono<HonoContext>()
    .use("*", peerSyncAuth)
    .get("/projects", async (c) => {
      try {
        const summaries = await runPromise(
          Effect.gen(function* () {
            const svc = yield* PeerSyncService;
            return yield* svc.listProjects;
          }),
        );
        return c.json({ projects: summaries });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return c.json({ error: message }, 500);
      }
    })
    .get("/projects/:projectId/sessions", async (c) => {
      const projectId = c.req.param("projectId");
      try {
        const sessions = await runPromise(
          Effect.gen(function* () {
            const svc = yield* PeerSyncService;
            return yield* svc.listSessionFiles(projectId);
          }),
        );
        return c.json({ sessions });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes("not found") ? 404 : 400;
        return c.json({ error: message }, status);
      }
    })
    .get("/projects/:projectId/sessions/:sessionId{.+\\.jsonl$}", async (c) => {
      const projectId = c.req.param("projectId");
      const rawSession = c.req.param("sessionId") ?? "";
      const sessionId = rawSession.replace(/\.jsonl$/, "");
      try {
        const file = await runPromise(
          Effect.gen(function* () {
            const svc = yield* PeerSyncService;
            return yield* svc.readSessionFile(projectId, sessionId);
          }),
        );
        c.header("Content-Type", "application/x-ndjson");
        c.header("X-Sync-Sha256", file.sha256);
        return c.body(file.content);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes("not found") ? 404 : 400;
        return c.json({ error: message }, status);
      }
    });
});
