import { FileSystem, Path } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Effect, Layer } from "effect";
import { serveStatic, upgradeWebSocket, websocket } from "hono/bun";
import { AgentSessionLayer } from "./core/agent-session/index.ts";
import { AgentSessionController } from "./core/agent-session/presentation/AgentSessionController.ts";
import { SessionAllowlistRepository } from "./core/claude-code/infrastructure/SessionAllowlistRepository.ts";
import { CCVAskUserQuestionController } from "./core/claude-code/presentation/CCVAskUserQuestionController.ts";
import { ClaudeCodeController } from "./core/claude-code/presentation/ClaudeCodeController.ts";
import { ClaudeCodePermissionController } from "./core/claude-code/presentation/ClaudeCodePermissionController.ts";
import { ClaudeCodeSessionProcessController } from "./core/claude-code/presentation/ClaudeCodeSessionProcessController.ts";
import { CCVAskUserQuestionService } from "./core/claude-code/services/CCVAskUserQuestionService.ts";
import { ClaudeCodeLifeCycleService } from "./core/claude-code/services/ClaudeCodeLifeCycleService.ts";
import { ClaudeCodePermissionService } from "./core/claude-code/services/ClaudeCodePermissionService.ts";
import { ClaudeCodeService } from "./core/claude-code/services/ClaudeCodeService.ts";
import { ClaudeCodeSessionProcessService } from "./core/claude-code/services/ClaudeCodeSessionProcessService.ts";
import { ProjectSettingsService } from "./core/claude-code/services/ProjectSettingsService.ts";
import { SSEController } from "./core/events/presentation/SSEController.ts";
import { FileWatcherService } from "./core/events/services/fileWatcher.ts";
import { FeatureFlagController } from "./core/feature-flag/presentation/FeatureFlagController.ts";
import { FileSystemController } from "./core/file-system/presentation/FileSystemController.ts";
import { GitController } from "./core/git/presentation/GitController.ts";
import { GitService } from "./core/git/services/GitService.ts";
import { NotificationController } from "./core/notification/presentation/NotificationController.ts";
import { NotificationService } from "./core/notification/services/NotificationService.ts";
import { isStrongSyncToken } from "./core/peer-sync/functions/syncToken.ts";
import { PeerSyncService } from "./core/peer-sync/services/PeerSyncService.ts";
import { isDevelopmentEnv } from "./core/platform/ccvEnv.ts";
import type { CliOptions } from "./core/platform/services/CcvOptionsService.ts";
import { ProjectRepository } from "./core/project/infrastructure/ProjectRepository.ts";
import { ProjectController } from "./core/project/presentation/ProjectController.ts";
import { ProjectMetaService } from "./core/project/services/ProjectMetaService.ts";
import { SessionTransferService } from "./core/project/services/SessionTransferService.ts";
import { RateLimitAutoScheduleService } from "./core/rate-limit/services/RateLimitAutoScheduleService.ts";
import { SchedulerConfigBaseDir } from "./core/scheduler/config.ts";
import { SchedulerService } from "./core/scheduler/domain/Scheduler.ts";
import { SchedulerController } from "./core/scheduler/presentation/SchedulerController.ts";
import { SearchController } from "./core/search/presentation/SearchController.ts";
import { SearchService } from "./core/search/services/SearchService.ts";
import { SessionRepository } from "./core/session/infrastructure/SessionRepository.ts";
import { SessionController } from "./core/session/presentation/SessionController.ts";
import { SessionMetaService } from "./core/session/services/SessionMetaService.ts";
import { SyncService } from "./core/sync/services/SyncService.ts";
import { TasksController } from "./core/tasks/presentation/TasksController.ts";
import { TasksService } from "./core/tasks/services/TasksService.ts";
import { TerminalService } from "./core/terminal/TerminalService.ts";
import { honoApp } from "./hono/app.ts";
import { InitializeService } from "./hono/initialize.ts";
import { AuthMiddleware } from "./hono/middleware/auth.middleware.ts";
import { routes } from "./hono/routes/index.ts";
import { DrizzleServiceLive } from "./lib/db/DrizzleServiceLive.ts";
import { platformLayer } from "./lib/effect/layers.ts";
import { serverLoggerLayer, withServerLogLevel } from "./logging.ts";
import { setupTerminalWebSocket } from "./terminal/terminalWebSocket.ts";

export const startServer = async (options: CliOptions) => {
  const runWithLogger = <A, E>(effect: Effect.Effect<A, E, never>) =>
    Effect.runPromise(
      effect.pipe(withServerLogLevel(options.verbose), Effect.provide(serverLoggerLayer)),
    );

  // biome-ignore lint/style/noProcessEnv: allow only here
  // oxlint-disable-next-line node/no-process-env -- configuration boundary
  const isDevelopment = isDevelopmentEnv(process.env.CCV_ENV);
  const apiOnly = options.apiOnly === true;

  if (!isDevelopment && !apiOnly) {
    const staticPath = await Effect.runPromise(
      Effect.gen(function* () {
        const path = yield* Path.Path;
        return path.resolve(import.meta.dirname, "static");
      }).pipe(Effect.provide(BunContext.layer)),
    );
    await runWithLogger(Effect.logInfo(`Serving static files from ${staticPath}`));
    const indexHtml = await Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        return yield* fs.readFileString(path.resolve(staticPath, "index.html"));
      }).pipe(Effect.provide(BunContext.layer)),
    );

    honoApp.use(
      "/*",
      serveStatic({
        root: staticPath,
      }),
    );

    honoApp.use("*", async (c, next) => {
      if (c.req.path.startsWith("/api")) {
        return next();
      }

      return c.html(indexHtml);
    });
  }

  const program = Effect.gen(function* () {
    yield* routes(honoApp, options);
    if (!apiOnly) {
      yield* setupTerminalWebSocket(honoApp, upgradeWebSocket);
    }
  })
    // 依存の浅い順にコンテナに pipe する必要がある
    .pipe(Effect.provide(MainLayer), Effect.scoped);

  await Effect.runPromise(program);

  const port = isDevelopment
    ? // biome-ignore lint/style/noProcessEnv: allow only here
      // oxlint-disable-next-line node/no-process-env -- configuration boundary
      (process.env.DEV_BE_PORT ?? "3401")
    : // biome-ignore lint/style/noProcessEnv: allow only here
      // oxlint-disable-next-line node/no-process-env -- configuration boundary
      (options.port ?? process.env.PORT ?? "3000");

  // biome-ignore lint/style/noProcessEnv: allow only here
  // oxlint-disable-next-line node/no-process-env -- configuration boundary
  const hostname = options.hostname ?? process.env.HOSTNAME ?? "localhost";

  const bunServer = Bun.serve({
    fetch: honoApp.fetch,
    websocket,
    port: parseInt(port, 10),
    hostname,
  });

  const mode = apiOnly ? " (API-only mode)" : "";
  void runWithLogger(
    Effect.logInfo(`Server is running on http://${hostname}:${bunServer.port}${mode}`),
  );

  const syncTokenConfigured = isStrongSyncToken(options.syncToken);
  const lanExposed = hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
  if (syncTokenConfigured) {
    void runWithLogger(
      Effect.logInfo(
        `[Peer Sync] enabled at /api/peer (Bearer token required, ${options.syncToken?.length ?? 0} chars)`,
      ),
    );
  } else if (lanExposed) {
    void runWithLogger(
      Effect.logWarning(
        "[Peer Sync] hostname is non-loopback but CCV_SYNC_TOKEN is unset. /api/peer routes will reject all requests with 503 until you set a token (>= 32 chars).",
      ),
    );
  }
};

const PlatformLayer = Layer.mergeAll(platformLayer, BunContext.layer);

const InfraBasics = Layer.mergeAll(
  ProjectMetaService.Live,
  SessionMetaService.Live,
  SessionAllowlistRepository.Live,
).pipe(Layer.provideMerge(SyncService.Live), Layer.provideMerge(DrizzleServiceLive));

const InfraRepos = Layer.mergeAll(ProjectRepository.Live, SessionRepository.Live).pipe(
  Layer.provideMerge(InfraBasics),
);

const InfraLayer = AgentSessionLayer.pipe(Layer.provideMerge(InfraRepos));

const DomainBase = Layer.mergeAll(
  CCVAskUserQuestionService.Live,
  ClaudeCodePermissionService.Live,
  ClaudeCodeSessionProcessService.Live,
  ClaudeCodeService.Live,
  GitService.Live,
  NotificationService.Live,
  PeerSyncService.Live,
  SchedulerService.Live,
  SchedulerConfigBaseDir.Live,
  SearchService.Live,
  SessionTransferService.Live,
  TasksService.Live,
).pipe(Layer.provideMerge(ProjectSettingsService.Live));

const DomainLayer = ClaudeCodeLifeCycleService.Live.pipe(Layer.provideMerge(DomainBase));

const AppServices = Layer.mergeAll(
  FileWatcherService.Live,
  RateLimitAutoScheduleService.Live,
  AuthMiddleware.Live,
  TerminalService.Live,
);

const ApplicationLayer = InitializeService.Live.pipe(Layer.provideMerge(AppServices));

const PresentationLayer = Layer.mergeAll(
  ProjectController.Live,
  SessionController.Live,
  AgentSessionController.Live,
  GitController.Live,
  ClaudeCodeController.Live,
  ClaudeCodeSessionProcessController.Live,
  CCVAskUserQuestionController.Live,
  ClaudeCodePermissionController.Live,
  FileSystemController.Live,
  SSEController.Live,
  NotificationController.Live,
  SchedulerController.Live,
  FeatureFlagController.Live,
  SearchController.Live,
  TasksController.Live,
);

const MainLayer = PresentationLayer.pipe(
  Layer.provideMerge(ApplicationLayer),
  Layer.provideMerge(DomainLayer),
  Layer.provideMerge(InfraLayer),
  Layer.provideMerge(PlatformLayer),
);
