import { createHash } from "node:crypto";
import { FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import type { InferEffect } from "../../../lib/effect/types.ts";
import { ApplicationContext } from "../../platform/services/ApplicationContext.ts";
import { decodeProjectId, validateProjectPath } from "../../project/functions/id.ts";
import { ProjectRepository } from "../../project/infrastructure/ProjectRepository.ts";
import { encodeSessionId, validateSessionId } from "../../session/functions/id.ts";

export type PeerProjectSummary = {
  id: string;
  claudeProjectPath: string;
  lastModifiedAt: string;
  sessionCount: number;
};

export type PeerSessionFile = {
  sessionId: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  modifiedAt: string;
};

const sha256OfBuffer = (buf: Uint8Array) => {
  const hash = createHash("sha256");
  hash.update(buf);
  return hash.digest("hex");
};

const LayerImpl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const appContext = yield* ApplicationContext;
  const projectRepository = yield* ProjectRepository;

  const ensureProjectDir = (projectId: string) =>
    Effect.gen(function* () {
      const decoded = decodeProjectId(projectId);
      const { claudeProjectsDirPath } = yield* appContext.claudeCodePaths;
      if (!validateProjectPath(decoded, claudeProjectsDirPath)) {
        return yield* Effect.fail(new Error("Invalid project path: outside allowed directory"));
      }
      // Map back to the on-disk dir under the projects/ root.
      // decoded is the absolute project path on the source machine; the on-disk
      // session dir uses encoded segments, so we resolve via projects root + last segment.
      const exists = yield* fs.exists(decoded);
      if (!exists) {
        return yield* Effect.fail(new Error("Project not found"));
      }
      return decoded;
    });

  const listProjects = Effect.gen(function* () {
    const { projects } = yield* projectRepository.getProjects();
    const { claudeProjectsDirPath } = yield* appContext.claudeCodePaths;
    // Filter using the project's on-disk dir (decoded from id), not the JSONL-extracted CWD.
    // The cache DB persists across runs and may contain projects from a different claudeDir.
    const summaries: PeerProjectSummary[] = projects
      .filter((p) => validateProjectPath(decodeProjectId(p.id), claudeProjectsDirPath))
      .map((p) => ({
        id: p.id,
        claudeProjectPath: p.claudeProjectPath,
        lastModifiedAt: p.lastModifiedAt.toISOString(),
        sessionCount: p.meta.sessionCount,
      }));
    return summaries;
  });

  const listSessionFiles = (projectId: string) =>
    Effect.gen(function* () {
      const projectDir = yield* ensureProjectDir(projectId);
      const entries = yield* fs.readDirectory(projectDir);
      const jsonlFiles = entries.filter((name) => name.endsWith(".jsonl"));

      const results: PeerSessionFile[] = yield* Effect.all(
        jsonlFiles.map((fileName) =>
          Effect.gen(function* () {
            const fullPath = path.join(projectDir, fileName);
            const stat = yield* fs.stat(fullPath);
            const buf = yield* fs.readFile(fullPath);
            const sessionId = encodeSessionId(fileName);
            return {
              sessionId,
              fileName,
              sizeBytes: Number(stat.size),
              sha256: sha256OfBuffer(buf),
              modifiedAt:
                stat.mtime._tag === "Some"
                  ? stat.mtime.value.toISOString()
                  : new Date(0).toISOString(),
            } satisfies PeerSessionFile;
          }),
        ),
        { concurrency: 4 },
      );

      return results;
    });

  const readSessionFile = (projectId: string, sessionId: string) =>
    Effect.gen(function* () {
      if (!validateSessionId(sessionId)) {
        return yield* Effect.fail(new Error("Invalid session id"));
      }
      const projectDir = yield* ensureProjectDir(projectId);
      const fullPath = path.join(projectDir, `${sessionId}.jsonl`);
      const exists = yield* fs.exists(fullPath);
      if (!exists) {
        return yield* Effect.fail(new Error("Session not found"));
      }
      const buf = yield* fs.readFile(fullPath);
      return {
        content: new TextDecoder().decode(buf),
        sha256: sha256OfBuffer(buf),
      };
    });

  return {
    listProjects,
    listSessionFiles,
    readSessionFile,
  };
});

export type IPeerSyncService = InferEffect<typeof LayerImpl>;
export class PeerSyncService extends Context.Tag("PeerSyncService")<
  PeerSyncService,
  IPeerSyncService
>() {
  static Live = Layer.effect(this, LayerImpl);
}
