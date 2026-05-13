import { SessionMetaService } from "@ccv/server/core/session/services/SessionMetaService";
import { createMockSessionMeta } from "@ccv/server/core/session/testing/createMockSessionMeta";
import type { SessionMeta } from "@ccv/server/core/types";
import { Effect, Layer } from "effect";

export const testSessionMetaServiceLayer = (options?: {
  meta?: SessionMeta;
  invalidateSession?: () => Effect.Effect<void>;
}) => {
  const { meta = createMockSessionMeta(), invalidateSession = () => Effect.void } = options ?? {};

  return Layer.mock(SessionMetaService, {
    getSessionMeta: () => Effect.succeed(meta),
    invalidateSession: invalidateSession,
  });
};
