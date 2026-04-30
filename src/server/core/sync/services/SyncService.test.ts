import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { makeDrizzleTestServiceLayer } from "../../../../testing/layers/testDrizzleServiceLayer.ts";
import { testPlatformLayer } from "../../../../testing/layers/testPlatformLayer.ts";
import { DrizzleService } from "../../../lib/db/DrizzleService.ts";
import { projects, sessions } from "../../../lib/db/schema.ts";
import { encodeProjectId } from "../../project/functions/id.ts";
import { encodeSessionId } from "../../session/functions/id.ts";
import { SyncService } from "./SyncService.ts";

const buildJsonl = (lines: object[]): string =>
  `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;

const validUserMessageJsonl = (sessionId: string) =>
  buildJsonl([
    {
      parentUuid: null,
      isSidechain: false,
      userType: "external",
      cwd: "/some/project",
      sessionId,
      version: "1.0.0",
      gitBranch: "",
      type: "user",
      message: { role: "user", content: "hello world" },
      uuid: "00000000-0000-4000-8000-000000000001",
      timestamp: "2026-04-30T00:00:00.000Z",
    },
  ]);

describe("SyncService.syncProjectList", () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "ccv-sync-test-"));
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it.live("leaves DB row untouched when file mtime equals the stored mtime", () => {
    const projectDir = join(tempRoot, "C--demo-project");
    mkdirSync(projectDir, { recursive: true });

    const sessionUuid = "22222222-2222-4222-8222-222222222222";
    const sessionFile = join(projectDir, `${sessionUuid}.jsonl`);
    writeFileSync(sessionFile, validUserMessageJsonl(sessionUuid));

    // Pin mtime to a whole-second value so DB seed (this number) matches what
    // Effect's fs.stat → Date.getTime() returns at runtime (no fractional ms drift).
    const wholeSecondMs = Math.floor(Date.now() / 1000) * 1000;
    utimesSync(sessionFile, wholeSecondMs / 1000, wholeSecondMs / 1000);
    const onDiskMtimeMs = statSync(sessionFile).mtimeMs;

    const projectId = encodeProjectId(projectDir);
    const sessionId = encodeSessionId(sessionFile);
    const sentinelCustomTitle = "should-not-be-overwritten";

    const drizzleLayer = makeDrizzleTestServiceLayer((db) => {
      db.insert(projects)
        .values({
          id: projectId,
          name: null,
          path: null,
          sessionCount: 1,
          dirMtimeMs: onDiskMtimeMs,
          syncedAt: onDiskMtimeMs,
        })
        .run();
      db.insert(sessions)
        .values({
          id: sessionId,
          projectId,
          filePath: sessionFile,
          messageCount: 999,
          firstUserMessageJson: null,
          customTitle: sentinelCustomTitle,
          totalCostUsd: 0,
          costBreakdownJson: null,
          tokenUsageJson: null,
          modelName: null,
          prLinksJson: null,
          fileMtimeMs: onDiskMtimeMs,
          lastModifiedAt: new Date(onDiskMtimeMs).toISOString(),
          syncedAt: onDiskMtimeMs,
        })
        .run();
    });

    return Effect.gen(function* () {
      const syncService = yield* SyncService;
      yield* syncService.syncProjectList(projectId);

      const { db } = yield* DrizzleService;
      const updated = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      // If the row had been re-parsed, customTitle would have been reset to null
      // and messageCount recomputed from the JSONL (= 1).
      expect(updated?.customTitle).toBe(sentinelCustomTitle);
      expect(updated?.messageCount).toBe(999);
    }).pipe(
      Effect.provide(SyncService.Live),
      Effect.provide(drizzleLayer),
      Effect.provide(NodeContext.layer),
      Effect.provide(
        testPlatformLayer({
          claudeCodePaths: { claudeProjectsDirPath: tempRoot },
        }),
      ),
    );
  });

  it.live("re-parses a session file when its mtime advanced beyond the DB row", () => {
    const projectDir = join(tempRoot, "C--demo-project");
    mkdirSync(projectDir, { recursive: true });

    const sessionUuid = "11111111-1111-4111-8111-111111111111";
    const sessionFile = join(projectDir, `${sessionUuid}.jsonl`);
    writeFileSync(sessionFile, validUserMessageJsonl(sessionUuid));

    const nowMs = Date.now();
    utimesSync(sessionFile, nowMs / 1000, nowMs / 1000);

    const projectId = encodeProjectId(projectDir);
    const sessionId = encodeSessionId(sessionFile);
    const staleMtimeMs = nowMs - 60_000;

    const drizzleLayer = makeDrizzleTestServiceLayer((db) => {
      db.insert(projects)
        .values({
          id: projectId,
          name: null,
          path: null,
          sessionCount: 1,
          dirMtimeMs: staleMtimeMs,
          syncedAt: staleMtimeMs,
        })
        .run();
      db.insert(sessions)
        .values({
          id: sessionId,
          projectId,
          filePath: sessionFile,
          messageCount: 0,
          firstUserMessageJson: null,
          customTitle: null,
          totalCostUsd: 0,
          costBreakdownJson: null,
          tokenUsageJson: null,
          modelName: null,
          prLinksJson: null,
          fileMtimeMs: staleMtimeMs,
          lastModifiedAt: new Date(staleMtimeMs).toISOString(),
          syncedAt: staleMtimeMs,
        })
        .run();
    });

    return Effect.gen(function* () {
      const syncService = yield* SyncService;
      yield* syncService.syncProjectList(projectId);

      const { db } = yield* DrizzleService;
      const updated = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
      expect(updated).toBeDefined();
      expect(updated?.firstUserMessageJson).not.toBeNull();
      expect(updated?.fileMtimeMs).toBeGreaterThan(staleMtimeMs);

      const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
      expect(project?.sessionCount).toBe(1);
    }).pipe(
      Effect.provide(SyncService.Live),
      Effect.provide(drizzleLayer),
      Effect.provide(NodeContext.layer),
      Effect.provide(
        testPlatformLayer({
          claudeCodePaths: { claudeProjectsDirPath: tempRoot },
        }),
      ),
    );
  });
});
