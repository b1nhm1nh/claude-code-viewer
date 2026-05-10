/**
 * Checks that the runtime is Bun and meets the minimum version.
 *
 * The repo is Bun-native: it uses `bun:sqlite` for the cache DB,
 * `Bun.serve` for HTTP/WS, and `@effect/platform-bun` for Effect platform
 * services. Running under Node.js will fail at import time.
 */
export const checkBunVersion = (): void => {
  if (typeof Bun === "undefined") {
    process.stderr.write(
      "Error: claude-code-viewer requires the Bun runtime (https://bun.sh).\n" +
        "Run with `bun dist/main.js` instead of `node`.\n",
    );
    process.exit(1);
  }
  const parts = Bun.version.split(".").map((s) => Number(s));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  if (major < 1 || (major === 1 && minor < 3)) {
    process.stderr.write(
      `Error: claude-code-viewer requires Bun >=1.3.0, but you are running ${Bun.version}.\n` +
        `Please upgrade your Bun version (https://bun.sh).\n`,
    );
    process.exit(1);
  }
};
