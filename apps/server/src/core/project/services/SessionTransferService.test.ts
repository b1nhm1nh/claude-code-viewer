import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunFileSystem, BunPath } from "@effect/platform-bun";
import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect } from "vitest";
import { EventBus } from "../../events/services/EventBus.ts";
import { ApplicationContext } from "../../platform/services/ApplicationContext.ts";
import { SyncService } from "../../sync/services/SyncService.ts";
import { encodeProjectId } from "../functions/id.ts";
import { SessionTransferService } from "./SessionTransferService.ts";

describe("SessionTransferService", () => {
  let testRoot: string;
  let claudeProjectsDirPath: string;
  let testLayer: Layer.Layer<SessionTransferService>;
  let syncCalls: string[];

  const writeJsonl = async (dir: string, sessionId: string, content = "{}\n") => {
    await writeFile(join(dir, `${sessionId}.jsonl`), content);
  };

  beforeEach(async () => {
    testRoot = join(tmpdir(), `transfer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    claudeProjectsDirPath = join(testRoot, "projects");
    await mkdir(claudeProjectsDirPath, { recursive: true });

    syncCalls = [];

    const applicationContextLayer = Layer.succeed(ApplicationContext, {
      claudeCodePaths: Effect.succeed({
        globalClaudeDirectoryPath: testRoot,
        claudeCommandsDirPath: join(testRoot, "commands"),
        claudeSkillsDirPath: join(testRoot, "skills"),
        claudeAgentsDirPath: join(testRoot, "agents"),
        claudeProjectsDirPath,
      }),
    });

    const syncServiceLayer = Layer.succeed(SyncService, {
      fullSync: () => Effect.void,
      syncSession: () => Effect.void,
      syncProjectList: (projectId: string) =>
        Effect.sync(() => {
          syncCalls.push(projectId);
        }),
    });

    testLayer = SessionTransferService.Live.pipe(
      Layer.provideMerge(syncServiceLayer),
      Layer.provideMerge(applicationContextLayer),
      Layer.provideMerge(EventBus.Live),
      Layer.provideMerge(BunFileSystem.layer),
      Layer.provideMerge(BunPath.layer),
    );
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  const makeProject = async (name: string) => {
    const dir = join(claudeProjectsDirPath, name);
    await mkdir(dir, { recursive: true });
    return { dir, projectId: encodeProjectId(dir) };
  };

  it.live("copy: copies all jsonl files, source untouched", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src"));
      const dst = yield* Effect.promise(() => makeProject("dst"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "s1", "first\n");
        await writeJsonl(src.dir, "s2", "second\n");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "copy",
        conflict: "skip",
      });

      expect(result.transferred.sort()).toEqual(["s1", "s2"]);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);

      const srcEntries = yield* Effect.promise(() => readdir(src.dir).then((e) => e.sort()));
      const dstEntries = yield* Effect.promise(() => readdir(dst.dir).then((e) => e.sort()));
      expect(srcEntries).toEqual(["s1.jsonl", "s2.jsonl"]);
      expect(dstEntries).toEqual(["s1.jsonl", "s2.jsonl"]);

      // copy mode only re-syncs the target
      expect(syncCalls).toEqual([dst.projectId]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("move: relocates files and re-syncs both projects", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-mv"));
      const dst = yield* Effect.promise(() => makeProject("dst-mv"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "m1");
        await writeJsonl(src.dir, "m2");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "move",
        conflict: "skip",
      });

      expect(result.transferred.sort()).toEqual(["m1", "m2"]);

      const srcEntries = yield* Effect.promise(() => readdir(src.dir));
      const dstEntries = yield* Effect.promise(() => readdir(dst.dir).then((e) => e.sort()));
      expect(srcEntries).toEqual([]);
      expect(dstEntries).toEqual(["m1.jsonl", "m2.jsonl"]);

      // move mode re-syncs target then source
      expect(syncCalls.sort()).toEqual([dst.projectId, src.projectId].sort());
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("conflict=skip: existing target file is preserved, others copied", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-skip"));
      const dst = yield* Effect.promise(() => makeProject("dst-skip"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "x", "src\n");
        await writeJsonl(src.dir, "y", "src\n");
        await writeJsonl(dst.dir, "x", "DST_ORIGINAL\n");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "copy",
        conflict: "skip",
      });

      expect(result.transferred).toEqual(["y"]);
      expect(result.skipped).toEqual(["x"]);

      const dstX = yield* Effect.promise(() => readFile(join(dst.dir, "x.jsonl"), "utf-8"));
      expect(dstX).toBe("DST_ORIGINAL\n");
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("conflict=overwrite: existing target file is replaced", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-ow"));
      const dst = yield* Effect.promise(() => makeProject("dst-ow"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "z", "FROM_SOURCE\n");
        await writeJsonl(dst.dir, "z", "stale\n");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "copy",
        conflict: "overwrite",
      });

      expect(result.transferred).toEqual(["z"]);
      expect(result.skipped).toEqual([]);

      const content = yield* Effect.promise(() => readFile(join(dst.dir, "z.jsonl"), "utf-8"));
      expect(content).toBe("FROM_SOURCE\n");
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("rejects when source equals target", () =>
    Effect.gen(function* () {
      const project = yield* Effect.promise(() => makeProject("same"));

      const service = yield* SessionTransferService;
      const result = yield* service
        .transfer({
          sourceProjectId: project.projectId,
          targetProjectId: project.projectId,
          mode: "copy",
          conflict: "skip",
        })
        .pipe(Effect.flip);

      expect(result.code).toBe("SAME_SOURCE_AND_TARGET");
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("rejects when target path is outside the Claude projects dir", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-outside"));
      const targetProjectId = encodeProjectId(join(testRoot, "evil-elsewhere"));

      const service = yield* SessionTransferService;
      const result = yield* service
        .transfer({
          sourceProjectId: src.projectId,
          targetProjectId,
          mode: "copy",
          conflict: "skip",
        })
        .pipe(Effect.flip);

      expect(result.code).toBe("INVALID_PROJECT_PATH");
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("ignores agent-* files", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-agent"));
      const dst = yield* Effect.promise(() => makeProject("dst-agent"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "regular");
        await writeFile(join(src.dir, "agent-foo.jsonl"), "{}\n");
        await writeFile(join(src.dir, "notes.txt"), "ignored\n");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "copy",
        conflict: "skip",
      });

      expect(result.transferred).toEqual(["regular"]);

      const dstEntries = yield* Effect.promise(() => readdir(dst.dir).then((e) => e.sort()));
      expect(dstEntries).toEqual(["regular.jsonl"]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("sessionIds filter: copies only listed sessions, leaves others in source", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-filter"));
      const dst = yield* Effect.promise(() => makeProject("dst-filter"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "keep1");
        await writeJsonl(src.dir, "keep2");
        await writeJsonl(src.dir, "skip-me");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "copy",
        conflict: "skip",
        sessionIds: ["keep1", "keep2"],
      });

      expect(result.transferred.sort()).toEqual(["keep1", "keep2"]);
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);

      const dstEntries = yield* Effect.promise(() => readdir(dst.dir).then((e) => e.sort()));
      expect(dstEntries).toEqual(["keep1.jsonl", "keep2.jsonl"]);

      const srcEntries = yield* Effect.promise(() => readdir(src.dir).then((e) => e.sort()));
      expect(srcEntries).toEqual(["keep1.jsonl", "keep2.jsonl", "skip-me.jsonl"]);
    }).pipe(Effect.provide(testLayer)),
  );

  it.live(
    "sessionIds filter: missing id is reported as failed with reason 'Session not found'",
    () =>
      Effect.gen(function* () {
        const src = yield* Effect.promise(() => makeProject("src-missing"));
        const dst = yield* Effect.promise(() => makeProject("dst-missing"));
        yield* Effect.promise(async () => {
          await writeJsonl(src.dir, "present");
        });

        const service = yield* SessionTransferService;
        const result = yield* service.transfer({
          sourceProjectId: src.projectId,
          targetProjectId: dst.projectId,
          mode: "copy",
          conflict: "skip",
          sessionIds: ["present", "ghost"],
        });

        expect(result.transferred).toEqual(["present"]);
        expect(result.failed).toEqual([{ sessionId: "ghost", reason: "Session not found" }]);
      }).pipe(Effect.provide(testLayer)),
  );

  it.live("sessionIds filter + conflict=skip: existing target file preserved", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-filter-skip"));
      const dst = yield* Effect.promise(() => makeProject("dst-filter-skip"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "dup", "FROM_SOURCE\n");
        await writeJsonl(dst.dir, "dup", "DST_ORIGINAL\n");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "copy",
        conflict: "skip",
        sessionIds: ["dup"],
      });

      expect(result.transferred).toEqual([]);
      expect(result.skipped).toEqual(["dup"]);

      const dstDup = yield* Effect.promise(() => readFile(join(dst.dir, "dup.jsonl"), "utf-8"));
      expect(dstDup).toBe("DST_ORIGINAL\n");
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("sessionIds filter + conflict=overwrite: existing target file replaced", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-filter-ow"));
      const dst = yield* Effect.promise(() => makeProject("dst-filter-ow"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "ow", "NEW\n");
        await writeJsonl(dst.dir, "ow", "OLD\n");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "copy",
        conflict: "overwrite",
        sessionIds: ["ow"],
      });

      expect(result.transferred).toEqual(["ow"]);
      expect(result.skipped).toEqual([]);

      const dstOw = yield* Effect.promise(() => readFile(join(dst.dir, "ow.jsonl"), "utf-8"));
      expect(dstOw).toBe("NEW\n");
    }).pipe(Effect.provide(testLayer)),
  );

  it.live("sessionIds filter in move mode: source file removed, both projects re-synced", () =>
    Effect.gen(function* () {
      const src = yield* Effect.promise(() => makeProject("src-filter-mv"));
      const dst = yield* Effect.promise(() => makeProject("dst-filter-mv"));
      yield* Effect.promise(async () => {
        await writeJsonl(src.dir, "stay");
        await writeJsonl(src.dir, "go");
      });

      const service = yield* SessionTransferService;
      const result = yield* service.transfer({
        sourceProjectId: src.projectId,
        targetProjectId: dst.projectId,
        mode: "move",
        conflict: "skip",
        sessionIds: ["go"],
      });

      expect(result.transferred).toEqual(["go"]);

      const srcEntries = yield* Effect.promise(() => readdir(src.dir).then((e) => e.sort()));
      const dstEntries = yield* Effect.promise(() => readdir(dst.dir).then((e) => e.sort()));
      expect(srcEntries).toEqual(["stay.jsonl"]);
      expect(dstEntries).toEqual(["go.jsonl"]);

      expect(syncCalls.sort()).toEqual([dst.projectId, src.projectId].sort());
    }).pipe(Effect.provide(testLayer)),
  );
});
