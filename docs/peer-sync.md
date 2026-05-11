# Peer Sync (LAN session-history mirror)

Peer Sync exposes a read-only HTTP surface so another machine on the same network can mirror your Claude Code session history (`~/.claude/projects/*.jsonl`) without giving that machine any control over chat, terminal, or file writes.

> [!IMPORTANT]
> Peer Sync is **not** an MCP server. It is a plain HTTP/REST API. You do not register it via `claude mcp add`. Peer machines either run `claude-code-viewer pull` or `curl` against `/api/peer/*` directly.

## Threat model in one paragraph

The sync token is a separate bearer credential, scoped exclusively to `/api/peer/*`. It cannot be exchanged for the app password and grants only read access to session JSONLs and their metadata. Anyone with the token can read everything in `~/.claude/projects/` on the source machine, which may include code, file paths, and any secrets that were pasted into past Claude conversations. Treat the token like an SSH key.

## Enabling on the source machine

```sh
# Generate a token (>= 32 chars). The server rejects anything shorter.
TOKEN=$(openssl rand -base64 24)
echo "$TOKEN"

# Bind to the LAN and enable the routes.
bun dist/main.js \
  --hostname 0.0.0.0 \
  --port 3000 \
  --sync-token "$TOKEN"
```

You can also set the token via environment:

```sh
export CCV_SYNC_TOKEN="$TOKEN"
bun dist/main.js --hostname 0.0.0.0 --port 3000
```

### Loading the token from a `.env` file

At startup the CLI reads `.env` and `.env.local` from the directory of the executable (`import.meta.dir`, i.e. `dist/` for production builds). Values are only applied to variables that are currently unset or empty — your shell environment always wins.

```sh
# dist/.env.local — next to the bundled main.js
CCV_SYNC_TOKEN=replace-with-a-32-plus-char-secret-string
# HOSTNAME=0.0.0.0
# PORT=3000
```

```sh
bun dist/main.js --hostname 0.0.0.0 --port 3000
# [ccv] loaded 1 env var(s) from .env.local
# [Peer Sync] enabled at /api/peer (Bearer token required, NN chars)
```

The loader is intentionally simple: `KEY=VALUE` per line, `#` comments, surrounding single or double quotes stripped, no shell expansion. Use it for secrets you do not want in shell history; do not check the file in (`.gitignore` already excludes `.env*.local`).

Boot output to watch for:

- `[Peer Sync] enabled at /api/peer (Bearer token required, NN chars)` — token is wired up.
- `[Peer Sync] hostname is non-loopback but CCV_SYNC_TOKEN is unset. /api/peer routes will reject all requests with 503 until you set a token (>= 32 chars).` — server is LAN-exposed but the routes are still off.

The token may sit in shell history. For long-lived deployments prefer a `.env` file or a secret manager.

## HTTP endpoints

All endpoints require `Authorization: Bearer <token>`. Without a configured server token they return **503**. With a wrong / missing token they return **401**.

| Method | Path                                                      | Returns                                                                                                      |
| ------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/peer/projects`                                      | `{ projects: PeerProjectSummary[] }`                                                                         |
| `GET`  | `/api/peer/projects/:projectId/sessions`                  | `{ sessions: PeerSessionFile[] }`                                                                            |
| `GET`  | `/api/peer/projects/:projectId/sessions/:sessionId.jsonl` | Raw JSONL body. `Content-Type: application/x-ndjson`. `X-Sync-Sha256` header carries the sha256 of the body. |

```ts
type PeerProjectSummary = {
  id: string; // base64url(absolute path of project dir)
  claudeProjectPath: string; // CWD reported by the source machine
  lastModifiedAt: string; // ISO-8601
  sessionCount: number;
};

type PeerSessionFile = {
  sessionId: string; // matches the file basename without `.jsonl`
  fileName: string;
  sizeBytes: number;
  sha256: string;
  modifiedAt: string; // ISO-8601
};
```

Server-side guardrails:

- `listProjects` filters by the on-disk `claudeProjectsDirPath`, so stale rows in the cache DB from a different `--claude-dir` are not exposed.
- `:projectId` is validated against the projects directory; path-traversal IDs return 400.
- `:sessionId` must match `^[a-zA-Z0-9_-]+$`. Anything else returns 400.

## Pulling from the peer machine

Install `claude-code-viewer` on the peer (same version recommended; the JSONL format only matters to the recipient's viewer, not to the CLI itself), then:

```sh
# Mirror every project the source exposes.
claude-code-viewer pull http://<source-ip>:3000 \
  --token "<TOKEN>" \
  --all

# Mirror a single project (id from /api/peer/projects).
claude-code-viewer pull http://<source-ip>:3000 \
  --token "<TOKEN>" \
  --project <projectId>

# Overwrite existing local files (default is skip-on-conflict).
claude-code-viewer pull http://<source-ip>:3000 \
  --token "<TOKEN>" --all --force

# Write into a custom Claude home (useful for backup or testing).
claude-code-viewer pull http://<source-ip>:3000 \
  --token "<TOKEN>" --all \
  --target-claude-dir /path/to/.claude
```

`pull` flags:

| Flag                        | Default     | Effect                                                            |
| --------------------------- | ----------- | ----------------------------------------------------------------- |
| `--token <token>`           | —           | Bearer token. Falls back to `CCV_SYNC_TOKEN`.                     |
| `--project <projectId>`     | —           | Pull only this project. Mutually exclusive with `--all`.          |
| `--all`                     | —           | Pull every project the peer exposes.                              |
| `--force`                   | off         | Overwrite local JSONLs that already exist. Default skips them.    |
| `--target-claude-dir <dir>` | `~/.claude` | Write under `<dir>/projects/` instead of the default Claude home. |

`pull` exits non-zero only when at least one session **failed** (HTTP error, sha mismatch). A successful run prints a JSON summary:

```json
{
  "projectsTouched": 1,
  "sessionsCopied": 5,
  "sessionsSkipped": 0,
  "sessionsFailed": 0,
  "errors": []
}
```

Each session is verified twice: once against the manifest sha256, and once against the `X-Sync-Sha256` response header.

## Smoke test with `curl`

```sh
TOKEN=...
HOST=http://localhost:3000

curl -fsS -H "Authorization: Bearer $TOKEN" "$HOST/api/peer/projects" | jq

PROJECT_ID=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$HOST/api/peer/projects" \
  | jq -r '.projects[0].id')

curl -fsS -H "Authorization: Bearer $TOKEN" \
  "$HOST/api/peer/projects/$PROJECT_ID/sessions" | jq

SESSION_ID=$(curl -fsS -H "Authorization: Bearer $TOKEN" \
  "$HOST/api/peer/projects/$PROJECT_ID/sessions" | jq -r '.sessions[0].sessionId')

curl -fsSI -H "Authorization: Bearer $TOKEN" \
  "$HOST/api/peer/projects/$PROJECT_ID/sessions/$SESSION_ID.jsonl" \
  | grep -i x-sync-sha256
```

## Running across the public internet

Don't expose `/api/peer/*` directly to the public internet. The route checks a bearer token but the rest of the app (chat, terminal, file system) is _not_ protected by it. Even with a strong sync token, an open `--hostname 0.0.0.0` deployment still exposes those other endpoints behind whatever protection `--password` provides (none, if you didn't set one). Use one of:

- A WireGuard / Tailscale tunnel between the two machines, then bind `--hostname` to the tunnel IP.
- SSH local-forward: `ssh -L 3000:localhost:3000 source-mac`, then `pull` against `http://localhost:3000`.
- A TLS-terminating reverse proxy (Caddy, nginx) in front of `claude-code-viewer`, with the proxy also enforcing client TLS or an HTTP basic gate.

## Failure modes worth knowing

- **503 "Peer sync disabled: server has no sync token configured"** — the server is up but `CCV_SYNC_TOKEN` / `--sync-token` is unset or below 32 chars. Fix on the server, no pull-side change needed.
- **401 "Unauthorized"** — token missing, malformed, or different from what the server has. Comparison is timing-safe.
- **400 "Invalid project path: outside allowed directory"** — usually means the peer's cache DB references a project that lives outside the current `--claude-dir`. `listProjects` filters these out; if you still see it, the source machine was restarted with a different `--claude-dir` and you supplied a stale ID by hand.
- **`sha256 mismatch` from `pull`** — the JSONL was modified mid-transfer or the network path corrupted bytes. Re-run the pull. Both the manifest and the response header are checked, so any mismatch is reported once with the offending file name.

## What this does **not** do (today)

- **No push.** Only the peer pulls; the source machine cannot push to a remote.
- **No diff / incremental updates.** Pull fetches the full JSONL each time. Conflict handling is binary (skip or overwrite).
- **No mDNS / Bonjour discovery.** You must know the peer's IP or hostname.
- **No multi-token / per-peer ACLs.** A single token unlocks the whole `/api/peer/*` surface.
- **No MCP protocol.** If you want Claude on machine B to call tools like `list_sessions(project)` against machine A, that needs a real MCP server — not yet built.
