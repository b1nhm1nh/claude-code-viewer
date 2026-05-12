import { Command } from "@effect/platform";
import { Context, Data, Effect, Layer } from "effect";
import type { InferEffect } from "../../lib/effect/types.ts";
import { CcvOptionsService } from "../platform/services/CcvOptionsService.ts";
import { ProjectMetaService } from "../project/services/ProjectMetaService.ts";
import {
  detectDefaultTerminal,
  isTerminalKey,
  type TerminalKey,
  terminalRegistry,
} from "./registry.ts";

export class TerminalNotAllowedError extends Data.TaggedError("TerminalNotAllowedError")<{
  key: string;
  reason: "unknown-key" | "wrong-platform";
  platform: NodeJS.Platform;
}> {}

export class ProjectPathMissingError extends Data.TaggedError("ProjectPathMissingError")<{
  projectId: string;
}> {}

export class ProjectLookupError extends Data.TaggedError("ProjectLookupError")<{
  projectId: string;
  message: string;
}> {}

const resolveKey = (
  requested: string | undefined,
  serverDefault: string | undefined,
  platform: NodeJS.Platform,
): Effect.Effect<TerminalKey, TerminalNotAllowedError> =>
  Effect.gen(function* () {
    const candidate = requested ?? serverDefault;

    if (candidate !== undefined && candidate !== "" && candidate !== "auto") {
      if (!isTerminalKey(candidate)) {
        return yield* Effect.fail(
          new TerminalNotAllowedError({ key: candidate, reason: "unknown-key", platform }),
        );
      }
      const spec = terminalRegistry[candidate];
      if (!spec.platforms.includes(platform)) {
        return yield* Effect.fail(
          new TerminalNotAllowedError({ key: candidate, reason: "wrong-platform", platform }),
        );
      }
      return candidate;
    }

    return detectDefaultTerminal(platform);
  });

const LayerImpl = Effect.gen(function* () {
  const projectMetaService = yield* ProjectMetaService;
  const ccvOptionsService = yield* CcvOptionsService;

  const launch = (options: { projectId: string; terminal?: string | undefined }) =>
    Effect.gen(function* () {
      const meta = yield* projectMetaService.getProjectMeta(options.projectId).pipe(
        Effect.mapError(
          (e) =>
            new ProjectLookupError({
              projectId: options.projectId,
              message: e instanceof Error ? e.message : String(e),
            }),
        ),
      );

      if (meta.projectPath === null) {
        return yield* Effect.fail(new ProjectPathMissingError({ projectId: options.projectId }));
      }

      const serverDefault = yield* ccvOptionsService.getCcvOptions("externalTerminal");
      const platform = process.platform;
      const key = yield* resolveKey(options.terminal, serverDefault, platform);

      const { exe, args } = terminalRegistry[key].spawn(meta.projectPath);

      const command = Command.make(exe, ...args).pipe(Command.workingDirectory(meta.projectPath));

      // Fire-and-forget: detach from the request fiber so the response returns
      // immediately and the terminal stays open after the HTTP call finishes.
      yield* Effect.forkDaemon(Command.exitCode(command));

      return { terminal: key, cwd: meta.projectPath };
    });

  return { launch };
});

export type ITerminalLauncherService = InferEffect<typeof LayerImpl>;

export class TerminalLauncherService extends Context.Tag("TerminalLauncherService")<
  TerminalLauncherService,
  ITerminalLauncherService
>() {
  static Live = Layer.effect(this, LayerImpl);
}
