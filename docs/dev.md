# Developer Documentation

This document provides technical details for developers contributing to Claude Code Viewer.

## Architecture Overview

### Frontend (`apps/web`)

- **Framework**: Vite + TanStack Router
- **UI Libraries**: React 19, Radix UI, Tailwind CSS
- **State Management**: Jotai (global state), TanStack Query (server state)

### Backend (`apps/server`)

- **API Framework**: Hono served by `Bun.serve`
  - Type-safe communication via Hono RPC
  - Validation using `@hono/zod-validator`
  - WebSocket via Hono's `upgradeWebSocket` (`hono/bun`) — terminal stream lives at `/ws/terminal`
- **Effect-TS**: All backend business logic is implemented using Effect-TS
  - Service layer managed through Effect Context (dependency injection container)
  - Controller → Service layered architecture, with each layer implemented in Effect
  - Type-safe error handling and side effect control
  - Platform abstractions provided by `@effect/platform-bun` (`BunContext.layer` covers `FileSystem.FileSystem`, `Path.Path`, `Command.string`)

### Shared (`packages/shared`)

Pure TypeScript library with no DOM or React dependencies. Contains:
- Zod schemas for JSONL validation (`conversation-schema/`)
- Domain types (`types/`)
- Utilities shared between frontend and backend
- i18n schema and server-side locale detection

### Data Source and Storage

- **Single Source of Truth (SSoT)**: Claude Code's standard session logs (`~/.claude/projects/`)
  - No separate database; reads directly from JSONL files
  - Strict validation via Zod schemas ensures conversation data integrity
- **Caching Mechanism**: For performance optimization, metadata is cached in `~/.claude-code-viewer/`
  - Frequently accessed data like session lists and project information
  - Cache is automatically invalidated via SSE events

### Real-time Synchronization

- **Server-Sent Events (SSE)**: Provides `/api/sse` endpoint (`apps/server/src/hono/routes/index.ts`)
  - Clients maintain persistent SSE connections to listen for server events
  - Real-time delivery of session log updates, process state changes, etc.
  - Type-safe SSE events (`TypeSafeSSE` service) guarantee payload types for each event kind via `SSEEventDeclaration`
  - Event types: connect, heartbeat, sessionListChanged, sessionChanged, sessionProcessChanged, permissionRequested
  - `SSEController` subscribes to EventBus and broadcasts typed events using `TypeSafeSSE.writeSSE()`
  - Client-side easily subscribes to events using the `useServerEventListener` hook

### Session Process Management

Claude Code Viewer provides advanced control over Claude Code session processes:

- After starting a session, the process remains in the background unless explicitly aborted
- Paused sessions can continue without changing the session-id (no resume needed)
- Memory sharing between processes is required, making production build verification crucial

## Development Environment Setup

### Requirements

- **Bun**: Version 1.3.0 or later (see [.bun-version](../.bun-version))
- **Package Manager**: `bun` (no pnpm, npm, or yarn)

### Initial Setup

```bash
# Install dependencies
bun install
```

## Starting the Development Server

### Development Mode

```bash
bun run dev
```

This command starts both servers in parallel using `concurrently`:

- Frontend: Vite development server (port 3403 by default, configurable via `DEV_FE_PORT`)
- Backend: `bun --watch apps/server/src/main.ts` (port 3404 by default, configurable via `DEV_BE_PORT`)

Frontend proxy configuration forwards `/api` requests to the backend server.

Lingui messages are compiled automatically before Vite starts on each `dev` invocation.

### Production Mode

Build and run in production mode:

```bash
# Build
bun run build

# Start production server
bun run start
```

**Build Process** (`./scripts/build.sh`):

1. Clean `dist/` directory
2. Compile i18n files (`lingui compile --typescript`)
3. Build frontend with Vite → `dist/static/`
4. Bundle backend with `bun build --target=bun` → `dist/main.js` (with `#!/usr/bin/env bun` shebang)
5. Copy `apps/server/src/lib/db/migrations/` → `dist/migrations/`

**Build Output Structure**:

```
dist/
├── main.js          # Backend server bundle + CLI entry point
├── main.js.map      # Source map
└── static/          # Frontend static files (Vite output)
    ├── index.html
    └── assets/
```

The production server serves static files and handles API requests on a single port (3000 by default, configurable via `PORT`). The `dist/main.js` is registered as the CLI binary in `package.json`'s `bin` field.

## Quality Assurance

### Code Formatter & Linter: oxlint + oxfmt

[oxc](https://oxc.rs/) tools (oxlint for linting, oxfmt for formatting) are used.

**Commands**:

```bash
# Auto-fix issues (lint fix + format)
bun run fix

# Check only (lint + format check, run in CI)
bun run lint
```

**Configuration**: `/.oxlintrc.json` (linting), `/.oxfmtrc.json` (formatting)

- Strict type-aware rules enabled (Effect-TS, React, JSX A11y, etc.)
- `no-process-env` set to error level
- `no-unsafe-type-assertion` enforces the no-`as` casting rule
- e2e and config files have relaxed rules

**CI Requirement**: Passing oxlint + oxfmt checks is mandatory for PR merges.

### Unit Tests: Vitest

Vitest-based tests are written for backend core logic (Effect-TS based service layer).

**Commands**:

```bash
# Run once (all packages)
bun run test

# Watch mode (in apps/server)
bun run --cwd apps/server test:watch
```

**Configuration**: each package has its own `vitest.config.ts`

**Test Coverage**: Primarily business logic under `apps/server/src/core/`

**CI Requirement**: All tests must pass for PR merges.

### Type Checking: TypeScript

```bash
bun run typecheck
```

Runs `turbo run check` across all packages in dependency order. Strict type configuration (`@tsconfig/strictest`) is adopted, emphasizing type safety.

### Quality Gate

Run all checks at once before committing:

```bash
bun run gatecheck check
./scripts/lingui-check.sh
```

### E2E Snapshot Testing (VRT)

Playwright-based snapshot capture is implemented to visually confirm UI changes.

**Note**: This is Visual Regression Testing (VRT) for confirming UI changes, not traditional E2E testing.

**Implementation**: Custom TypeScript script (not standard Playwright config file)

#### Local Execution

```bash
# Run server startup and snapshot capture together
bun run e2e

# Or execute manually
bun run e2e:start-server        # Start server
bun run e2e:capture-snapshots   # Capture snapshots
```

**Important**: In local environments, UI varies based on the current path. **Do not commit locally captured snapshots**.

#### Automatic Updates in CI

When the `vrt` label is added to a PR, the VRT workflow (`.github/workflows/vrt.yml`) automatically captures and commits snapshots. Use this label for PRs with UI changes to update snapshots.

## Monorepo Structure

This project uses a Bun workspaces + Turborepo monorepo.

```
claude-code-viewer/
├── package.json              # Workspace root (turbo, typescript devDeps only)
├── turbo.json                # Task orchestration
├── tsconfig.json             # Base TS config (no DOM, no JSX)
├── apps/
│   ├── server/               # @ccv/server — Hono + Effect-TS backend
│   │   ├── src/
│   │   │   ├── core/         # Domain modules (session, project, git, …)
│   │   │   ├── hono/         # Hono app, routes, middleware
│   │   │   ├── lib/db/       # Drizzle + SQLite (migrations live here)
│   │   │   └── main.ts       # CLI entry point
│   │   ├── mock-global-claude-dir/  # Mock ~/.claude for tests
│   │   └── drizzle.config.ts
│   └── web/                  # @ccv/web — Vite + React frontend
│       ├── src/
│       │   ├── routes/       # TanStack Router routes
│       │   ├── app/          # Page components and hooks
│       │   ├── components/   # Shared UI components (shadcn/ui)
│       │   └── lib/          # Frontend-only logic (atoms, auth, i18n, SSE, …)
│       ├── index.html
│       ├── vite.config.ts
│       └── lingui.config.ts
├── packages/
│   ├── shared/               # @ccv/shared — types and utils (no DOM)
│   │   └── src/
│   │       ├── conversation-schema/  # Zod schemas for JSONL validation
│   │       ├── types/
│   │       ├── utils/
│   │       └── i18n/         # SupportedLocale type + server-side locale detection
│   └── testing/              # @ccv/testing — reusable Effect test layers
│       └── src/layers/
└── scripts/                  # build.sh, lingui-sort.js, lingui-check.sh, …
```

### Package aliases

| Import | Resolves to |
|--------|-------------|
| `@ccv/shared/conversation-schema/…` | `packages/shared/src/conversation-schema/…` |
| `@ccv/server/hono/routes` | `apps/server/src/hono/routes/…` |
| `@/…` (inside apps/web) | `apps/web/src/…` |
| `@/…` (inside apps/server) | `apps/server/src/…` |

### i18n workflow

Source JSON lives in `apps/web/src/lib/i18n/locales/{locale}/messages.json`.

```bash
# Extract new strings from source (updates messages.json)
bun run --cwd apps/web lingui:extract

# Compile to .ts (done automatically on bun run dev)
bun run --cwd apps/web lingui:compile
```

`lingui compile --typescript` runs automatically at the start of `bun run dev` so the compiled `.ts` catalogs are always fresh.

## Development Tips

1. **Learning Effect-TS**: The backend is built with Effect-TS. Refer to the [official documentation](https://effect.website/)
2. **Debugging SSE**: Check the Network tab in browser developer tools to inspect SSE connections
3. **Log Inspection**: Directly reference JSONL files under `~/.claude/projects/` to understand data structures
4. **Mock Data**: Mock data for tests in `apps/server/mock-global-claude-dir/` is useful for development reference

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with appropriate tests
4. Ensure all quality checks pass (`bun run gatecheck check`)
5. Submit a pull request with a clear description of your changes

For UI changes, add the `vrt` label to your PR to update visual snapshots.
