import { FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import type { InferEffect } from "../../../lib/effect/types.ts";
import { EventBus } from "../../events/services/EventBus.ts";
import { ApplicationContext } from "../../platform/services/ApplicationContext.ts";
import { isRegularSessionFile } from "../../session/functions/isRegularSessionFile.ts";
import { SyncService } from "../../sync/services/SyncService.ts";
import { decodeProjectId, validateProjectPath } from "../functions/id.ts";

export type TransferMode = "copy" | "move";
export type TransferConflict = "skip" | "overwrite";

export type TransferParams = {
  readonly sourceProjectId: string;
  readonly targetProjectId: string;
  readonly mode: TransferMode;
  readonly conflict: TransferConflict;
  readonly sessionIds?: ReadonlyArray<string>;
};

export type TransferResult = {
  readonly transferred: string[];
  readonly skipped: string[];
  readonly failed: { sessionId: string; reason: string }[];
};

export class SessionTransferError extends Error {
  readonly code: "SAME_SOURCE_AND_TARGET" | "INVALID_PROJECT_PATH" | "PROJECT_NOT_FOUND";
  constructor(
    code: "SAME_SOURCE_AND_TARGET" | "INVALID_PROJECT_PATH" | "PROJECT_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "SessionTransferError";
  }
}

const stripJsonlExtension = (fileName: string): string =>
  fileName.endsWith(".jsonl") ? fileName.slice(0, -".jsonl".length) : fileName;

const layerImpl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* ApplicationContext;
  const syncService = yield* SyncService;
  const eventBus = yield* EventBus;

  const transfer = (params: TransferParams): Effect.Effect<TransferResult, SessionTransferError> =>
    Effect.gen(function* () {
      const { sourceProjectId, targetProjectId, mode, conflict } = params;

      if (sourceProjectId === targetProjectId) {
        return yield* Effect.fail(
          new SessionTransferError(
            "SAME_SOURCE_AND_TARGET",
            "Source and target project must be different.",
          ),
        );
      }

      const { claudeProjectsDirPath } = yield* context.claudeCodePaths;
      const srcDir = decodeProjectId(sourceProjectId);
      const dstDir = decodeProjectId(targetProjectId);

      if (
        !validateProjectPath(srcDir, claudeProjectsDirPath) ||
        !validateProjectPath(dstDir, claudeProjectsDirPath)
      ) {
        return yield* Effect.fail(
          new SessionTransferError(
            "INVALID_PROJECT_PATH",
            "Project path is outside the Claude projects directory.",
          ),
        );
      }

      const srcExists = yield* fs.exists(srcDir).pipe(Effect.orElseSucceed(() => false));
      if (!srcExists) {
        return yield* Effect.fail(
          new SessionTransferError(
            "PROJECT_NOT_FOUND",
            `Source project directory does not exist: ${srcDir}`,
          ),
        );
      }

      yield* fs.makeDirectory(dstDir, { recursive: true }).pipe(Effect.catchAll(() => Effect.void));

      const allEntries = yield* fs.readDirectory(srcDir).pipe(Effect.orElseSucceed(() => []));
      const presentSessionFiles = allEntries.filter(isRegularSessionFile);

      const transferred: string[] = [];
      const skipped: string[] = [];
      const failed: { sessionId: string; reason: string }[] = [];

      let sessionFiles: string[];
      if (params.sessionIds !== undefined) {
        const presentIds = new Set(presentSessionFiles.map(stripJsonlExtension));
        sessionFiles = [];
        for (const id of params.sessionIds) {
          if (presentIds.has(id)) {
            sessionFiles.push(`${id}.jsonl`);
          } else {
            failed.push({ sessionId: id, reason: "Session not found" });
          }
        }
      } else {
        sessionFiles = presentSessionFiles;
      }

      for (const fileName of sessionFiles) {
        const sessionId = stripJsonlExtension(fileName);
        const srcFullPath = path.join(srcDir, fileName);
        const dstFullPath = path.join(dstDir, fileName);

        const dstExists = yield* fs.exists(dstFullPath).pipe(Effect.orElseSucceed(() => false));

        if (dstExists && conflict === "skip") {
          skipped.push(sessionId);
          continue;
        }

        if (dstExists && conflict === "overwrite") {
          yield* fs.remove(dstFullPath, { force: true }).pipe(Effect.catchAll(() => Effect.void));
        }

        const op =
          mode === "copy"
            ? fs.copyFile(srcFullPath, dstFullPath)
            : fs.rename(srcFullPath, dstFullPath).pipe(
                Effect.catchAll(() =>
                  // Fallback for cross-device rename (EXDEV): copy then delete source.
                  fs
                    .copyFile(srcFullPath, dstFullPath)
                    .pipe(
                      Effect.flatMap(() =>
                        fs
                          .remove(srcFullPath, { force: true })
                          .pipe(Effect.catchAll(() => Effect.void)),
                      ),
                    ),
                ),
              );

        const result = yield* Effect.either(op);
        if (result._tag === "Right") {
          transferred.push(sessionId);
        } else {
          const reason = result.left instanceof Error ? result.left.message : String(result.left);
          failed.push({ sessionId, reason });
        }
      }

      // Refresh DB rows + FTS for both projects so the UI reflects the new state.
      yield* syncService.syncProjectList(targetProjectId).pipe(Effect.catchAll(() => Effect.void));
      if (mode === "move") {
        yield* syncService
          .syncProjectList(sourceProjectId)
          .pipe(Effect.catchAll(() => Effect.void));
      }

      yield* eventBus.emit("sessionListChanged", { projectId: targetProjectId });
      if (mode === "move") {
        yield* eventBus.emit("sessionListChanged", { projectId: sourceProjectId });
      }

      return { transferred, skipped, failed };
    });

  return { transfer };
});

export type ISessionTransferService = InferEffect<typeof layerImpl>;

export class SessionTransferService extends Context.Tag("SessionTransferService")<
  SessionTransferService,
  ISessionTransferService
>() {
  static readonly Live = Layer.effect(this, layerImpl);
}
