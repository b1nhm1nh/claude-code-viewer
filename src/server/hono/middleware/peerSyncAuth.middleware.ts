import { Effect, Runtime } from "effect";
import { createMiddleware } from "hono/factory";
import { isStrongSyncToken, safeTokenEqual } from "../../core/peer-sync/functions/syncToken.ts";
import { CcvOptionsService } from "../../core/platform/services/CcvOptionsService.ts";
import type { HonoContext } from "../app.ts";
import { getHonoRuntime } from "../runtime.ts";

const getBearer = (header: string | undefined): string | undefined => {
  if (header === undefined || header === "") return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme === undefined || token === undefined) return undefined;
  if (scheme.toLowerCase() !== "bearer") return undefined;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const createPeerSyncAuthMiddleware = () =>
  Effect.gen(function* () {
    const runtime = yield* getHonoRuntime;
    const runPromise = Runtime.runPromise(runtime);

    return createMiddleware<HonoContext>(async (c, next) => {
      const configuredToken = await runPromise(
        Effect.gen(function* () {
          const options = yield* CcvOptionsService;
          return yield* options.getCcvOptions("syncToken");
        }),
      );

      if (!isStrongSyncToken(configuredToken)) {
        return c.json({ error: "Peer sync disabled: server has no sync token configured" }, 503);
      }

      const provided = getBearer(c.req.header("Authorization"));
      if (provided === undefined || !safeTokenEqual(provided, configuredToken)) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      await next();
      return undefined;
    });
  });
