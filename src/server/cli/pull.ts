import { createHash } from "node:crypto";
import { FileSystem, Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect } from "effect";
import { z } from "zod";

export type PullOptions = {
  peerUrl: string;
  token: string;
  project?: string | undefined;
  all?: boolean | undefined;
  force?: boolean | undefined;
  claudeDir?: string | undefined;
};

export type PullResult = {
  projectsTouched: number;
  sessionsCopied: number;
  sessionsSkipped: number;
  sessionsFailed: number;
  errors: string[];
};

const peerProjectSummarySchema = z.object({
  id: z.string(),
  claudeProjectPath: z.string(),
  lastModifiedAt: z.string(),
  sessionCount: z.number(),
});

const peerSessionFileSchema = z.object({
  sessionId: z.string(),
  fileName: z.string(),
  sizeBytes: z.number(),
  sha256: z.string(),
  modifiedAt: z.string(),
});

const projectsResponseSchema = z.object({
  projects: z.array(peerProjectSummarySchema),
});

const sessionsResponseSchema = z.object({
  sessions: z.array(peerSessionFileSchema),
});

type PeerProjectSummary = z.infer<typeof peerProjectSummarySchema>;
type PeerSessionFile = z.infer<typeof peerSessionFileSchema>;

const sha256Hex = (buf: Uint8Array): string => {
  const hash = createHash("sha256");
  hash.update(buf);
  return hash.digest("hex");
};

const encodeProjectDirName = (claudeProjectPath: string): string =>
  claudeProjectPath.replaceAll("\\", "/").replaceAll("/", "-");

const fetchJson = (url: string, token: string) =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`GET ${url} -> ${res.status}: ${body}`);
      }
      return (await res.json()) as unknown;
    },
    catch: (e) => (e instanceof Error ? e : new Error(String(e))),
  });

const fetchBytes = (url: string, token: string) =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`GET ${url} -> ${res.status}: ${body}`);
      }
      const arrayBuf = await res.arrayBuffer();
      return {
        buf: new Uint8Array(arrayBuf),
        sha: res.headers.get("x-sync-sha256"),
      };
    },
    catch: (e) => (e instanceof Error ? e : new Error(String(e))),
  });

const resolveClaudeDir = (override: string | undefined) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    if (override !== undefined && override !== "") return path.resolve(override);
    // biome-ignore lint/style/noProcessEnv: CLI entry point
    // oxlint-disable-next-line node/no-process-env
    const home = process.env.HOME ?? process.env.USERPROFILE;
    if (home === undefined || home === "") {
      return yield* Effect.fail(new Error("HOME / USERPROFILE not set; cannot resolve ~/.claude"));
    }
    return path.resolve(home, ".claude");
  });

const parseProjectList = (raw: unknown): PeerProjectSummary[] =>
  projectsResponseSchema.parse(raw).projects;

const parseSessionList = (raw: unknown): PeerSessionFile[] =>
  sessionsResponseSchema.parse(raw).sessions;

export const runPull = async (options: PullOptions): Promise<PullResult> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const baseUrl = options.peerUrl.replace(/\/$/, "");
      const claudeDir = yield* resolveClaudeDir(options.claudeDir);
      const projectsDir = path.resolve(claudeDir, "projects");

      const result: PullResult = {
        projectsTouched: 0,
        sessionsCopied: 0,
        sessionsSkipped: 0,
        sessionsFailed: 0,
        errors: [],
      };

      const allProjectsRaw = yield* fetchJson(`${baseUrl}/api/peer/projects`, options.token);
      const allProjects = parseProjectList(allProjectsRaw);

      const targetProjects =
        options.project !== undefined
          ? allProjects.filter((p) => p.id === options.project)
          : options.all === true
            ? allProjects
            : [];

      if (targetProjects.length === 0) {
        if (options.project !== undefined) {
          return yield* Effect.fail(new Error(`Project ${options.project} not found on peer`));
        }
        if (options.all !== true) {
          return yield* Effect.fail(new Error("Specify --project <id> or --all"));
        }
      }

      yield* fs.makeDirectory(projectsDir, { recursive: true });

      for (const project of targetProjects) {
        result.projectsTouched += 1;
        const dirName = encodeProjectDirName(project.claudeProjectPath);
        const localProjectDir = path.resolve(projectsDir, dirName);
        yield* fs.makeDirectory(localProjectDir, { recursive: true });

        const sessionsRawResult = yield* Effect.either(
          fetchJson(
            `${baseUrl}/api/peer/projects/${encodeURIComponent(project.id)}/sessions`,
            options.token,
          ),
        );
        if (sessionsRawResult._tag === "Left") {
          result.errors.push(`list sessions for ${project.id}: ${sessionsRawResult.left.message}`);
          continue;
        }
        const sessions = parseSessionList(sessionsRawResult.right);

        for (const session of sessions) {
          const localPath = path.resolve(localProjectDir, session.fileName);
          const exists = yield* fs.exists(localPath);
          if (exists && options.force !== true) {
            result.sessionsSkipped += 1;
            continue;
          }
          const fileResult = yield* Effect.either(
            fetchBytes(
              `${baseUrl}/api/peer/projects/${encodeURIComponent(project.id)}/sessions/${encodeURIComponent(session.sessionId)}.jsonl`,
              options.token,
            ),
          );
          if (fileResult._tag === "Left") {
            result.errors.push(`${project.id}/${session.sessionId}: ${fileResult.left.message}`);
            result.sessionsFailed += 1;
            continue;
          }
          const { buf, sha } = fileResult.right;
          const localSha = sha256Hex(buf);
          if (localSha !== session.sha256) {
            result.errors.push(
              `${project.id}/${session.sessionId}: sha256 mismatch (manifest=${session.sha256.slice(0, 8)}, body=${localSha.slice(0, 8)})`,
            );
            result.sessionsFailed += 1;
            continue;
          }
          if (sha !== null && sha !== localSha) {
            result.errors.push(
              `${project.id}/${session.sessionId}: header sha mismatch (header=${sha.slice(0, 8)}, body=${localSha.slice(0, 8)})`,
            );
            result.sessionsFailed += 1;
            continue;
          }
          yield* fs.writeFile(localPath, buf);
          result.sessionsCopied += 1;
        }
      }

      return result;
    }).pipe(Effect.provide(BunContext.layer)),
  );
