import { SessionRepository } from "@ccv/server/core/session/infrastructure/SessionRepository";
import type { Session } from "@ccv/server/core/types";
import { Effect, Layer } from "effect";

export const testSessionRepositoryLayer = (options?: { sessions: Array<Session> }) => {
  const { sessions = [] } = options ?? {};

  return Layer.mock(SessionRepository, {
    getSessions: () => {
      return Effect.succeed({ sessions });
    },
    getSession: () => Effect.fail(new Error("Not implemented in mock")),
  });
};
