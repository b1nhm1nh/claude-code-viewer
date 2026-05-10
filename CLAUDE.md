# CLAUDE.md

## Critical Rules (Read First)

**Runtime**: This is a **Bun-native** project. Bun 1.3+ is the only supported runtime. Node.js will fail at startup.

**Language**:

- Code, comments, and commit messages should be in English

**NEVER**:

- Use `as` type casting in ANY context including test code (explain the problem to the user instead)
- Use raw `fetch` or bypass TanStack Query for API calls
- Run `bun run dev` or `bun run start` (dev servers — they don't exit)
- Use `node:fs`, `node:path`, `child_process` directly (use Effect-TS `FileSystem.FileSystem`, `Path.Path`, `Command.string`)
- Re-introduce `pnpm`, `npm`, `npx`, `node`, or `@hono/node-server` — the project migrated off them

**ALWAYS**:

- Use Effect-TS for all backend side effects
- Use Hono RPC + TanStack Query for all API calls
- Follow TDD: write tests first, then implement
- Run `bun run typecheck` and `bun run fix` before committing
- Use `bun` as the package manager (`bun install`, `bun add`, `bun remove`)

## Commit Message Rules

Conventional Commits format: `type: description`

**Release Note Awareness**:

- Commit messages are included in release notes; write for users.

**Type Selection**:
| Type | Release Note | Purpose |
|------|--------------|---------|
| `feat` | Features | User-facing new feature |
| `fix` | Bug Fixes | User-impacting bug fix |
| `chore`, `ci`, `build`, `refactor` | Excluded | Internal changes |

**Critical**: Use `fix` only for user-facing bugs. Internal fixes (linter errors, type errors, build scripts) must use `chore`.

**Message Quality Examples**:

- Bad: `fix: fix lingui error` (internal issue)
- Bad: `feat: add button` (too vague)
- Good: `feat: add dark mode toggle to settings`
- Good: `fix: session list not updating after deletion`
- Good: `chore: update lingui compiled messages`

## Project Overview

Claude Code Viewer reads Claude Code session logs directly from JSONL files (`~/.claude/projects/`) with zero data loss. It's a web-based client built as a CLI tool serving a Vite application.

**Core Architecture**:

- Frontend: Vite + TanStack Router + React 19 + TanStack Query
- Backend: Hono served by `Bun.serve` + Effect-TS (all business logic)
- Cache DB: `bun:sqlite` via `drizzle-orm/bun-sqlite` (production) / `node:sqlite` (vitest workers)
- WebSocket: Hono `upgradeWebSocket` from `hono/bun` (terminal stream at `/ws/terminal`)
- Data: Direct JSONL reads with strict Zod validation
- Real-time: Server-Sent Events (SSE) for live updates
- Bundler: `bun build --target=bun` for the backend, Vite for the frontend

## Recommended Coding Process

This project is designed with the philosophy of achieving both rapid feedback and code quality maintenance (passing checks = nearly guaranteed runtime correctness) by leveraging:

- Strict typing with Effect-TS and ADT
- Constraints for maintaining code quality configured in Lint as much as possible
- Dependency injection and effective testing with Effect-TS

For development, we recommend implementing with t-wada's TDD development style.

For checks, you can run `bun run gatecheck check` to execute all the above checks against the diff at once, so proceed with implementation in a loop of problem detection and fixing with gatecheck.

By utilizing this, you can quickly inspect code with static checks and unit tests.

## Quality Gate (MUST follow)

After changing source code, always run before committing:

```bash
bun run gatecheck check
./scripts/lingui-check.sh
```

## Key Directory Patterns

- `src/server/hono/route.ts` - Hono API routes definition (all routes defined here)
- `src/server/core/` - Effect-TS business logic (domain modules: session, project, git, etc.)
- `src/server/lib/db/DrizzleService.ts` - SQLite Tag (no driver imports — keeps `bun:sqlite` out of test runtime)
- `src/server/lib/db/DrizzleServiceLive.ts` - Production Live layer using `bun:sqlite`
- `src/lib/conversation-schema/` - Zod schemas for JSONL validation
- `src/testing/layers/` - Reusable Effect test layers (`testPlatformLayer` is the foundation; `testDrizzleServiceLayer` uses `node:sqlite`)
- `src/routes/` - TanStack Router routes

## Coding Standards

### Backend: Effect-TS

**Prioritize Pure Functions**:

- Extract logic into pure, testable functions whenever possible
- Pure functions are easier to test, reason about, and maintain
- Only use Effect-TS when side effects or state management is required

**Use Effect-TS for Side Effects and State**:

- Mandatory for I/O operations, async code, and stateful logic
- Avoid class-based implementations or mutable variables for state
- Use Effect-TS's functional patterns for state management
- Reference: https://effect.website/llms.txt

**Platform Layer**: Use `@effect/platform-bun` (`BunContext.layer`) — not `@effect/platform-node`. Tests provide the same `BunContext.layer`; vitest workers run on Node but the Effect platform abstraction works identically.

**Testing with Layers**:

```typescript
import { expect, test } from "vitest";
import { Effect } from "effect";
import { testPlatformLayer } from "@/testing/layers";
import { yourEffect } from "./your-module";

test("example", async () => {
  const result = await Effect.runPromise(yourEffect.pipe(Effect.provide(testPlatformLayer)));
  expect(result).toBe(expectedValue);
});
```

**Avoid Node.js Built-ins**:

- Use `FileSystem.FileSystem` instead of `node:fs`
- Use `Path.Path` instead of `node:path`
- Use `Command.string` instead of `child_process`

This enables dependency injection and proper testing.

**Database Driver Split** (important):

- `src/server/lib/db/DrizzleService.ts` exports only the `DrizzleService` Tag and structural types (`DrizzleDb`, `RawSqliteDb`) — no runtime imports of `bun:sqlite`.
- `src/server/lib/db/DrizzleServiceLive.ts` is the production Live layer using `bun:sqlite` + `drizzle-orm/bun-sqlite`. Imported by `startServer.ts` only.
- `src/testing/layers/testDrizzleServiceLayer.ts` constructs an in-memory DB via `node:sqlite` + `drizzle-orm/node-sqlite` because vitest workers run on Node. Both drivers satisfy `DrizzleDb = BaseSQLiteDatabase<"sync", unknown, schema>`.
- **Never** add a top-level `import "bun:sqlite"` to `DrizzleService.ts` — it would break test imports.

**Type Safety - NO `as` Casting**:

- `as` casting is **strictly prohibited**
- If types seem unsolvable without `as`, explain the problem to the user and ask for guidance
- Valid alternatives: type guards, assertion functions, Zod schema validation

### Frontend: API Access

**Hono RPC + TanStack Query Only**:

```typescript
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const { data } = useQuery({
  queryKey: ["example"],
  queryFn: () => api.endpoint.$get().then((res) => res.json()),
});
```

Raw `fetch` and direct requests are prohibited.

### Tech Standards

- **Runtime/Package Manager**: Bun 1.3+ (`bun-version` pinned in `.bun-version`)
- **Linter/Formatter**: oxlint + oxfmt (not ESLint/Prettier/Biome). Custom plugin at `dev/lints/conventions.js` (no-barrel-file, colocated-tests, module-boundaries) is wired via `.oxlintrc.json`.
- **Type Config**: `@tsconfig/strictest` with `types: ["@types/bun", ...]`
- **Path Alias**: `@/*` maps to `./src/*`
- **Tests**: Vitest (`bun run vitest`) — workers run on Node, so node-only APIs (`node:sqlite`, `node:fs/promises`) are safe in test files.

## Architecture Details

### HTTP & WebSocket (Bun.serve)

`startServer.ts` boots the server via `Bun.serve({ fetch: honoApp.fetch, websocket, port, hostname })`. Static files are served by `serveStatic` from `hono/bun`. Terminal WebSocket lives at `/ws/terminal` and is registered with `upgradeWebSocket` from `hono/bun`; auth is checked inside the upgrade handler before `onOpen` is allowed to register the client.

### SSE (Server-Sent Events)

**When to Use SSE**:

- Delivering session log updates to frontend
- Notifying clients of background process state changes
- **Never** for request-response patterns (use Hono RPC instead)

**Implementation**:

- Server: `/api/sse` endpoint with type-safe events (`TypeSafeSSE`)
- Client: `useServerEventListener` hook for subscriptions

### Data Layer

- **Single Source of Truth**: `~/.claude/projects/*.jsonl`
- **Cache DB**: `~/.claude-code-viewer/cache.db` (SQLite via `bun:sqlite`, schema migrated on startup; invalidated via SSE when source changes)
- **Validation**: Strict Zod schemas ensure every field is captured

### Home Directory Resolution (Cross-Platform)

`ApplicationContext` and `SchedulerConfigBaseDir` resolve the home directory via `HOME ?? USERPROFILE`. Windows does not set `HOME` by default — only `USERPROFILE` — so any new code that needs the home dir should follow the same fallback pattern (or read it through these services).

### Session Process Management

Claude Code processes remain alive in the background (unless aborted), allowing session continuation without changing session-id.

### Terminal (PTY)

`@replit/ruspty` is an `optionalDependency`. On Windows, `TerminalService` short-circuits to a disabled stub with a single `INFO` log line because ruspty has no `win32` binary. Linux/macOS load the binary lazily via dynamic `import()`.

## Development Tips

1. **Session Logs**: Examine `~/.claude/projects/` JSONL files to understand data structures
2. **Mock Data**: `mock-global-claude-dir/` contains E2E test mocks (useful reference for schema examples)
3. **Effect-TS Help**: https://effect.website/llms.txt
4. **Bun-only debugging**: If you ever see `Cannot find package 'bun:sqlite'` from a test, you accidentally hoisted a `bun:sqlite` import into the Tag file — move it back to `DrizzleServiceLive.ts`.

## References

Project-specific conventions and procedures. Follow Progressive Disclosure: **read only the reference you need, when you need it**.

| Path                                    | When to Read                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `docs/guidelines/commit_message.md`     | Before creating a commit                                                                              |
| `docs/guidelines/branch_naming.md`      | Before creating a branch                                                                              |
| `docs/guidelines/definition_of_done.md` | Before marking a task as done                                                                         |
| `docs/guidelines/qa_guideline.md`       | When verifying implemented features. Delegate to a QA or general-purpose subagent with this file path |
| `docs/guidelines/internal_review.md`    | When requesting a code review                                                                         |
