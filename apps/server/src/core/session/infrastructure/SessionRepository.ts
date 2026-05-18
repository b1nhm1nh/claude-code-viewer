import { FileSystem } from "@effect/platform";
import { desc, eq, sql } from "drizzle-orm";
import { Context, Effect, Layer, Option, Ref } from "effect";
import { DrizzleService } from "../../../lib/db/DrizzleService.ts";
import { projects, sessions } from "../../../lib/db/schema.ts";
import type { InferEffect } from "../../../lib/effect/types.ts";
import { parseJsonl } from "../../claude-code/functions/parseJsonl.ts";
import { ApplicationContext } from "../../platform/services/ApplicationContext.ts";
import { decodeProjectId, validateProjectPath } from "../../project/functions/id.ts";
import { SyncService } from "../../sync/services/SyncService.ts";
import type { ExtendedConversation, Session, SessionDetail } from "../../types.ts";
import { decodeSessionId, validateSessionId } from "../functions/id.ts";
import { SessionMetaService } from "../services/SessionMetaService.ts";

type ParsedCacheEntry = {
  readonly mtimeMs: number;
  readonly size: number;
  readonly conversations: ExtendedConversation[];
};

// Keep at most this many parsed sessions in memory. With 50MB raw JSONL each,
// expect ~100-200MB resident at the cap. Tune if memory becomes a concern.
const PARSED_CACHE_MAX_ENTRIES = 8;

const LayerImpl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const sessionMetaService = yield* SessionMetaService;
  const appContext = yield* ApplicationContext;
  const { db } = yield* DrizzleService;
  const syncService = yield* SyncService;

  // LRU cache keyed by sessionPath. Stores parsed conversations alongside the
  // file's (mtime, size) signature so we can detect appends/edits and re-parse.
  const parsedCacheRef = yield* Ref.make<Map<string, ParsedCacheEntry>>(new Map());

  const readCachedConversations = (sessionPath: string, mtimeMs: number, size: number) =>
    Effect.gen(function* () {
      const cache = yield* Ref.get(parsedCacheRef);
      const cached = cache.get(sessionPath);
      if (cached !== undefined && cached.mtimeMs === mtimeMs && cached.size === size) {
        // Touch entry to refresh LRU order.
        yield* Ref.update(parsedCacheRef, (current) => {
          const next = new Map(current);
          next.delete(sessionPath);
          next.set(sessionPath, cached);
          return next;
        });
        return cached.conversations;
      }

      const content = yield* fs.readFileString(sessionPath);
      const conversations = parseJsonl(content);

      yield* Ref.update(parsedCacheRef, (current) => {
        const next = new Map(current);
        next.delete(sessionPath);
        next.set(sessionPath, { mtimeMs, size, conversations });
        while (next.size > PARSED_CACHE_MAX_ENTRIES) {
          const oldestKey = next.keys().next().value;
          if (oldestKey === undefined) break;
          next.delete(oldestKey);
        }
        return next;
      });

      return conversations;
    });

  const getSession = (projectId: string, sessionId: string) =>
    Effect.gen(function* () {
      // Validate sessionId contains only safe characters
      if (!validateSessionId(sessionId)) {
        return yield* Effect.fail(new Error("Invalid session ID: contains unsafe characters"));
      }

      // Validate that the project path is within the Claude projects directory
      const projectPath = decodeProjectId(projectId);
      const { claudeProjectsDirPath } = yield* appContext.claudeCodePaths;
      if (!validateProjectPath(projectPath, claudeProjectsDirPath)) {
        return yield* Effect.fail(new Error("Invalid project path: outside allowed directory"));
      }

      const sessionPath = decodeSessionId(projectId, sessionId);

      // Check if session file exists
      const exists = yield* fs.exists(sessionPath);
      if (!exists) {
        return { session: null };
      }

      const sessionDetail = yield* Effect.gen(function* () {
        // Stat first — used both for cache key and lastModifiedAt
        const stat = yield* fs.stat(sessionPath);
        const mtime = Option.getOrElse(stat.mtime, () => new Date());
        const mtimeMs = mtime.getTime();
        const size = Number(stat.size);

        // Use parsed-conversation cache. Re-parse only if (mtime, size) changed.
        const conversations = yield* readCachedConversations(sessionPath, mtimeMs, size);

        // Get session metadata
        const meta = yield* sessionMetaService.getSessionMeta(projectId, sessionId);

        const sessionDetail: SessionDetail = {
          id: sessionId,
          jsonlFilePath: sessionPath,
          meta,
          conversations,
          lastModifiedAt: mtime,
        };

        return sessionDetail;
      });

      return {
        session: sessionDetail,
      };
    });

  const getSessions = (
    projectId: string,
    options?: {
      maxCount?: number;
      cursor?: string;
    },
  ) =>
    Effect.gen(function* () {
      const { maxCount = 20, cursor } = options ?? {};

      const claudeProjectPath = decodeProjectId(projectId);

      // Validate that the project path is within the Claude projects directory
      const { claudeProjectsDirPath } = yield* appContext.claudeCodePaths;
      if (!validateProjectPath(claudeProjectPath, claudeProjectsDirPath)) {
        return yield* Effect.fail(new Error("Invalid project path: outside allowed directory"));
      }

      // Ensure project is synced in DB
      const projectExists = db
        .select({ one: sql<number>`1` })
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();
      if (!projectExists) {
        yield* syncService.syncProjectList(projectId).pipe(Effect.catchAll(() => Effect.void));
      }

      // Fetch all sessions for project ordered by lastModifiedAt DESC
      const rows = db
        .select()
        .from(sessions)
        .where(eq(sessions.projectId, projectId))
        .orderBy(desc(sessions.lastModifiedAt))
        .all();

      if (rows.length === 0) {
        return { sessions: [] };
      }

      // Cursor-based pagination
      const startIndex =
        cursor !== undefined
          ? (() => {
              const idx = rows.findIndex((r) => r.id === cursor);
              return idx === -1 ? 0 : idx + 1;
            })()
          : 0;

      const sessionsToReturn = rows.slice(startIndex, startIndex + maxCount);

      const sessionsResult: Session[] = yield* Effect.all(
        sessionsToReturn.map((row) =>
          Effect.gen(function* () {
            const meta = yield* sessionMetaService.getSessionMeta(projectId, row.id);
            return {
              id: row.id,
              jsonlFilePath: row.filePath,
              lastModifiedAt: new Date(row.lastModifiedAt),
              meta,
            } satisfies Session;
          }),
        ),
        { concurrency: "unbounded" },
      );

      return { sessions: sessionsResult };
    });

  return {
    getSession,
    getSessions,
  };
});

export type ISessionRepository = InferEffect<typeof LayerImpl>;

export class SessionRepository extends Context.Tag("SessionRepository")<
  SessionRepository,
  ISessionRepository
>() {
  static Live = Layer.effect(this, LayerImpl);
}
