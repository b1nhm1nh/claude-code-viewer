// bun:sqlite is intentional here — only the production layer uses it.
import { Database } from "bun:sqlite";
import { fileURLToPath } from "node:url";
import { FileSystem, Path } from "@effect/platform";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Effect, Layer } from "effect";
import { ApplicationContext } from "../../core/platform/services/ApplicationContext.ts";
import { type DrizzleDb, DrizzleService, type RawSqliteDb } from "./DrizzleService.ts";
import * as schema from "./schema.ts";

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));
const FTS5_DDL = `
  CREATE VIRTUAL TABLE IF NOT EXISTS session_messages_fts USING fts5(
    session_id UNINDEXED,
    project_id UNINDEXED,
    role UNINDEXED,
    content,
    conversation_index UNINDEXED,
    tokenize='trigram'
  )
`;

const initDbAtPath = (cacheDbPath: string): { db: DrizzleDb; rawDb: RawSqliteDb } => {
  const sqlite = new Database(cacheDbPath);
  sqlite.prepare("PRAGMA journal_mode = WAL").run();
  sqlite.prepare("PRAGMA foreign_keys = ON").run();

  const db = drizzle({ client: sqlite, schema });
  migrate(db, { migrationsFolder });
  sqlite.prepare(FTS5_DDL).run();

  return { db, rawDb: sqlite };
};

export const DrizzleServiceLive = Layer.effect(
  DrizzleService,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const context = yield* ApplicationContext;
    const claudeCodePaths = yield* context.claudeCodePaths;

    const homeDirectory = path.dirname(claudeCodePaths.globalClaudeDirectoryPath);
    const dbDirPath = path.resolve(homeDirectory, ".claude-code-viewer");
    const dbPath = path.resolve(dbDirPath, "cache.db");

    yield* fs.makeDirectory(dbDirPath, { recursive: true });

    const dbResult = yield* Effect.either(
      Effect.try({
        try: () => initDbAtPath(dbPath),
        catch: (error) => error,
      }),
    );

    if (dbResult._tag === "Right") {
      return dbResult.right;
    }

    const error = dbResult.left;
    yield* Effect.logWarning(
      `[DrizzleService] Migration failed, recreating cache DB: ${error instanceof Error ? error.message : String(error)}`,
    );

    try {
      new Database(dbPath).close();
    } catch {
      // ignore
    }

    for (const suffix of ["", "-wal", "-shm"]) {
      yield* fs
        .remove(`${dbPath}${suffix}`, { force: true })
        .pipe(Effect.catchAll(() => Effect.void));
    }

    return initDbAtPath(dbPath);
  }),
);
