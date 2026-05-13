import { Effect, Runtime } from "effect";
import type { UpgradeWebSocket, WSContext } from "hono/ws";
import { z } from "zod";
import { TerminalService } from "../core/terminal/TerminalService.ts";
import type { HonoAppType } from "../hono/app.ts";
import { AuthMiddleware } from "../hono/middleware/auth.middleware.ts";

type ServerMessage =
  | { type: "hello"; sessionId: string; seq: number }
  | { type: "output"; seq: number; data: string }
  | { type: "snapshot"; seq: number; data: string }
  | { type: "exit"; code: number }
  | { type: "pong" };

type ClientMessage =
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "signal"; name: string }
  | { type: "sync"; lastSeq: number }
  | { type: "ping" };

const parseCookies = (cookieHeader: string | undefined) => {
  const result: Record<string, string> = {};
  if (cookieHeader === undefined || cookieHeader === "") return result;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === undefined || rawKey === "") continue;
    result[rawKey] = rest.join("=");
  }
  return result;
};

const clientMessageSchema = z.union([
  z.object({ type: z.literal("input"), data: z.string() }),
  z.object({ type: z.literal("resize"), cols: z.number(), rows: z.number() }),
  z.object({ type: z.literal("signal"), name: z.string() }),
  z.object({ type: z.literal("sync"), lastSeq: z.number() }),
  z.object({ type: z.literal("ping") }),
]);

const parseClientMessage = (payload: string): ClientMessage | undefined => {
  try {
    const result = clientMessageSchema.safeParse(JSON.parse(payload));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

const sendJson = (client: WSContext, payload: ServerMessage) => {
  if (client.readyState !== 1) return;
  client.send(JSON.stringify(payload));
};

export const setupTerminalWebSocket = (app: HonoAppType, upgradeWebSocket: UpgradeWebSocket) =>
  Effect.gen(function* () {
    const terminalService = yield* TerminalService;
    const { getAuthState } = yield* AuthMiddleware;
    const { authEnabled, validSessionToken } = yield* getAuthState;
    const runtime = yield* Effect.runtime<TerminalService>();
    const runPromise = Runtime.runPromise(runtime);

    app.get(
      "/ws/terminal",
      upgradeWebSocket((c) => {
        const cookieHeader = c.req.header("cookie");
        const authorized =
          !authEnabled || parseCookies(cookieHeader)["ccv-session"] === validSessionToken;

        const url = new URL(c.req.url);
        const sessionIdParam = url.searchParams.get("sessionId");
        const requestedSessionId =
          sessionIdParam !== null && sessionIdParam.length > 0 ? sessionIdParam : undefined;
        const cwdParam = url.searchParams.get("cwd");
        const cwd = cwdParam !== null && cwdParam.length > 0 ? cwdParam : undefined;

        let activeSessionId: string | undefined;
        let activeClient: WSContext | undefined;

        return {
          onOpen: (_evt, ws) => {
            if (!authorized) {
              ws.close(1008, "Unauthorized");
              return;
            }
            activeClient = ws;
            void (async () => {
              try {
                const session = await runPromise(
                  terminalService.getOrCreateSession(requestedSessionId, cwd),
                );
                activeSessionId = session.id;
                sendJson(ws, {
                  type: "hello",
                  sessionId: session.id,
                  seq: session.seq,
                });
                await runPromise(terminalService.registerClient(session.id, ws));
              } catch {
                ws.close(1011, "Session initialization failed");
              }
            })();
          },
          onMessage: (evt, ws) => {
            if (!authorized || activeSessionId === undefined) return;
            const sessionId = activeSessionId;
            const data = evt.data;
            const text =
              typeof data === "string"
                ? data
                : data instanceof ArrayBuffer
                  ? new TextDecoder().decode(data)
                  : data instanceof Uint8Array
                    ? new TextDecoder().decode(data)
                    : undefined;
            if (text === undefined || text === "") return;
            const message = parseClientMessage(text);
            if (!message) return;
            if (message.type === "input") {
              void runPromise(terminalService.writeInput(sessionId, message.data));
              return;
            }
            if (message.type === "resize") {
              void runPromise(terminalService.resize(sessionId, message.cols, message.rows));
              return;
            }
            if (message.type === "signal") {
              void runPromise(terminalService.signal(sessionId, message.name));
              return;
            }
            if (message.type === "sync") {
              void runPromise(terminalService.snapshotSince(sessionId, message.lastSeq)).then(
                (snapshot) => {
                  if (!snapshot) return;
                  sendJson(ws, {
                    type: "snapshot",
                    seq: snapshot.seq,
                    data: snapshot.data,
                  });
                },
              );
              return;
            }
            if (message.type === "ping") {
              sendJson(ws, { type: "pong" });
            }
          },
          onClose: () => {
            if (activeSessionId !== undefined && activeClient !== undefined) {
              void runPromise(terminalService.unregisterClient(activeSessionId, activeClient));
            }
          },
        };
      }),
    );
  });
