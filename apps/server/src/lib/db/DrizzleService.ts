import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { Context } from "effect";
import type * as schema from "./schema.ts";

/**
 * `DrizzleDb` is parameterised over `unknown` for the run-result type so that
 * the production layer (uses `bun:sqlite`, `TRunResult = void`) and the test
 * layer (uses `node:sqlite`, `TRunResult = StatementResultingChanges`) can both
 * satisfy it. We never read `.run()` results, so the run-result is genuinely
 * irrelevant at the type level.
 */
export type DrizzleDb = BaseSQLiteDatabase<"sync", unknown, typeof schema>;

/**
 * Minimal structural type for the raw SQLite handle. Both `bun:sqlite`'s
 * `Database` and `node:sqlite`'s `DatabaseSync` satisfy it.
 */
export type RawSqliteDb = {
  close(): void;
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
};

/**
 * Effect Tag for the SQLite-backed cache database. The production `Live` layer
 * lives in `DrizzleServiceLive.ts` and uses `bun:sqlite`; tests construct their
 * own `Layer.succeed` via `testDrizzleServiceLayer.ts` (which uses
 * `node:sqlite`, since vitest workers run on Node). Splitting the Tag from the
 * Live layer keeps `bun:sqlite` out of the test runtime's import graph.
 */
export class DrizzleService extends Context.Tag("DrizzleService")<
  DrizzleService,
  { readonly db: DrizzleDb; readonly rawDb: RawSqliteDb }
>() {}
