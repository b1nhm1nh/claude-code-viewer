# Developer Documentation

This document provides technical details for developers contributing to Claude Code Viewer.

## Architecture Overview

### Tech Stack

- **Frontend**: Next.js 15 with React 19, TypeScript (strict configuration)
- **Backend**: Hono.js API routes with Zod validation
- **Styling**: Tailwind CSS with Radix UI components (shadcn/ui pattern)
- **State Management**: TanStack Query + Jotai atoms
- **Code Quality**: Biome (replaces ESLint + Prettier)
- **Testing**: Vitest with watch mode

### Project Structure

```text
src/
├── app/                     # Next.js app router
│   ├── projects/           # Project listing and detail pages
│   │   └── [projectId]/    # Dynamic project routes
│   └── layout.tsx          # Root layout with providers
├── server/                 # Backend API implementation
│   ├── service/            # Core business logic
│   │   ├── file-watcher.ts # Real-time file monitoring
│   │   ├── paths.ts        # File system path constants
│   │   └── project.ts      # Project/session operations
│   └── api/                # Hono API route handlers
├── lib/
│   ├── conversation-schema/ # Zod schemas for JSONL validation
│   ├── api/                # Type-safe API client
│   └── utils/              # Shared utilities
└── components/
    ├── ui/                 # Reusable UI components
    └── conversation/       # Conversation-specific components
```

## Development Setup

### Prerequisites

- Node.js 18 or later
- pnpm (recommended package manager)
- Claude Code with sample conversation data in `~/.claude/projects/`

### Installation

```bash
git clone https://github.com/d-kimuson/claude-code-viewer.git
cd claude-code-viewer
pnpm install
```

### Development Commands

```bash
# Start development server (port 3400)
pnpm dev

# Type checking
pnpm typecheck

# Linting and formatting
pnpm lint       # Check all rules
pnpm fix        # Fix all issues

# Testing
pnpm test       # Run once
pnpm test:watch # Watch mode
```

### Build Process

```bash
pnpm build      # Creates standalone Next.js build in .next/standalone/
```

The build creates a standalone application that includes all dependencies for deployment.

## API Architecture

### Endpoints

- `GET /api/projects` - List all projects with metadata
- `GET /api/projects/:projectId` - Get project details and sessions
- `GET /api/projects/:projectId/sessions/:sessionId` - Get conversation data
- `GET /api/events/state_changes` - Server-Sent Events for real-time updates

### Data Flow

1. **File System → Parser**: Read JSONL files from `~/.claude/projects/`
2. **Parser → Validation**: Validate each line against Zod conversation schemas
3. **API → Frontend**: Type-safe data transfer with TanStack Query
4. **Real-time**: File watcher emits SSE events for live updates

### Backend Services

#### Core Services (`src/server/service/`)

- **`getProjects()`** - Scans project directories, returns sorted metadata
- **`getProject(projectId)`** - Fetches project details and session list
- **`getSession(projectId, sessionId)`** - Parses JSONL conversation files
- **`parseJsonl()`** - Validates JSONL lines against conversation schema

#### File Watching (`src/server/service/file-watcher.ts`)

- Singleton service using Node.js `fs.watch()` 
- Monitors `~/.claude/projects/` recursively
- Emits `project_changed` and `session_changed` events
- Includes heartbeat mechanism (30s intervals)

## Data Validation

### Conversation Schema (`src/lib/conversation-schema/`)

Modular Zod schemas handle different conversation entry types:

- **Entry Types**: User, Assistant, System, Summary
- **Content Types**: Text, Tool Use, Tool Result, Thinking
- **Validation**: Strict type checking with fallback parsing

### Command Detection

Special XML-like command parsing for enhanced display:

```typescript
parseCommandXml(content: string) // Extracts command names and arguments
```

## Frontend Architecture

### Component Hierarchy

```text
RootLayout (providers, error boundaries)
├── ProjectList (grid of project cards)
├── ProjectDetail 
│   ├── SessionList (filterable session grid)
│   └── SessionDetail
│       ├── SessionSidebar (navigation)
│       └── ConversationList (message display)
```

### State Management

- **Server State**: TanStack Query with suspense boundaries
- **Client State**: Jotai atoms for UI state (filters, sidebar state)
- **Real-time**: Server-Sent Events with automatic reconnection

### Type Safety

- **API Types**: Generated from Hono route definitions
- **Schemas**: Zod validation with TypeScript inference
- **Build-time**: Strict TypeScript configuration via `@tsconfig/strictest`

## Code Conventions

### File Organization

- **Services**: Business logic in `src/server/service/`
- **Components**: UI components with co-located styles
- **Schemas**: Modular Zod schemas with clear interfaces
- **Hooks**: Custom hooks for data fetching and state management

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`

### Code Style

- **Formatter**: Biome (replaces Prettier)
- **Linter**: Biome (replaces ESLint)
- **Config**: Extends `@tsconfig/strictest` for maximum type safety

## Testing Strategy

### Test Structure

- **Unit Tests**: Individual functions and components
- **Integration Tests**: API routes and data flow
- **Setup**: Vitest with global test configuration

### Test Commands

```bash
pnpm test       # Run all tests once
pnpm test:watch # Watch mode for development
```

## Performance Considerations

### Optimization Strategies

- **Static Generation**: Pre-built project metadata
- **Suspense Boundaries**: Progressive loading of conversation data  
- **File Watching**: Efficient recursive directory monitoring
- **Memory Management**: Streaming JSONL parsing for large files

### Bundle Analysis

The app uses Next.js with Turbopack for fast development builds and optimized production bundles.

## Contributing Guidelines

### Pull Request Process

1. **Fork** the repository and create a feature branch
2. **Implement** changes following existing code conventions
3. **Test** your changes with `pnpm test`
4. **Lint** code with `pnpm fix`
5. **Type check** with `pnpm typecheck`
6. **Submit** PR with clear description and test coverage

### Code Review Criteria

- Type safety and error handling
- Performance impact on large conversation files
- UI/UX consistency with existing design
- Test coverage for new functionality
- Documentation updates for API changes

### Development Tips

- **Hot Reload**: Use `pnpm dev` for fast development iteration
- **Debug Mode**: Enable verbose logging in file watcher service
- **Mock Data**: Create sample JSONL files for testing edge cases
- **Browser DevTools**: React Query DevTools available in development

## Deployment

### Build Artifacts

- **Standalone**: Self-contained application in `.next/standalone/`
- **Static Assets**: Copied to standalone directory during build
- **Entry Point**: `dist/index.js` for CLI usage

### Environment Variables

- **PORT**: Server port (default: 3400)
- **NODE_ENV**: Environment mode (development/production)

The application is designed to be deployed as a standalone executable that can be installed via npm/npx.
