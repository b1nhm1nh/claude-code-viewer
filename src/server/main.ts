#!/usr/bin/env bun
import { Command } from "commander";
import { Effect } from "effect";
import packageJson from "../../package.json" with { type: "json" };
import { checkBunVersion } from "./bunVersionCheck.ts";
import { runPull } from "./cli/pull.ts";
import type { CliOptions } from "./core/platform/services/CcvOptionsService.ts";
import { checkDeprecatedEnvs } from "./core/platform/services/DeprecatedEnvDetector.ts";
import { startServer } from "./startServer.ts";

checkBunVersion();

const program = new Command();

program.name(packageJson.name).version(packageJson.version).description(packageJson.description);

// start server
program
  .option("-p, --port <port>", "port to listen on")
  .option("-h, --hostname <hostname>", "hostname to listen on")
  .option("-v, --verbose", "enable verbose debug logging")
  .option("-P, --password <password>", "password to authenticate")
  .option("-e, --executable <executable>", "path to claude code executable")
  .option("--claude-dir <claude-dir>", "path to claude directory")
  .option("--terminal-disabled", "disable the in-app terminal panel when enabled")
  .option("--terminal-shell <path>", "shell executable for terminal sessions")
  .option("--terminal-unrestricted", "disable restricted shell flags for bash sessions")
  .option("--api-only", "run in API-only mode without Web UI")
  .option(
    "--sync-token <token>",
    "bearer token enabling /api/peer LAN sync endpoints (>= 32 chars)",
  )
  .action(async (options: CliOptions) => {
    // Check for deprecated environment variables and show migration guide
    await Effect.runPromise(checkDeprecatedEnvs);

    await startServer(options);
  });

// pull session history from a peer
program
  .command("pull <peer-url>")
  .description("Pull Claude Code session history from a peer running --sync-token enabled server")
  .option("--token <token>", "bearer token for the peer's /api/peer endpoints")
  .option("--project <projectId>", "pull only sessions for the given peer project id")
  .option("--all", "pull every project from the peer")
  .option("--force", "overwrite local JSONL files instead of skipping when present")
  .option(
    "--target-claude-dir <dir>",
    "override the local Claude home directory to write into (default: ~/.claude)",
  )
  .action(
    async (
      peerUrl: string,
      cmd: {
        token?: string | undefined;
        project?: string | undefined;
        all?: boolean | undefined;
        force?: boolean | undefined;
        targetClaudeDir?: string | undefined;
      },
    ) => {
      // biome-ignore lint/style/noProcessEnv: CLI entry point
      // oxlint-disable-next-line node/no-process-env
      const token = cmd.token ?? process.env.CCV_SYNC_TOKEN;
      if (token === undefined || token === "") {
        process.stderr.write("error: --token is required (or set CCV_SYNC_TOKEN)\n");
        process.exit(2);
      }
      try {
        const result = await runPull({
          peerUrl,
          token,
          project: cmd.project,
          all: cmd.all,
          force: cmd.force,
          claudeDir: cmd.targetClaudeDir,
        });
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        if (result.sessionsFailed > 0) {
          process.exit(1);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`pull failed: ${message}\n`);
        process.exit(1);
      }
    },
  );

const main = async () => {
  await program.parseAsync(process.argv);
};

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
