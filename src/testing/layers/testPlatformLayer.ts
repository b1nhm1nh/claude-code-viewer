import { Path } from "@effect/platform";
import { Effect, Layer } from "effect";
import { DEFAULT_LOCALE } from "../../lib/i18n/localeDetection";
import { EventBus } from "../../server/core/events/services/EventBus";
import type { EnvSchema } from "../../server/core/platform/schema";
import {
  ApplicationContext,
  type ClaudeCodePaths,
} from "../../server/core/platform/services/ApplicationContext";
import {
  type CcvOptions,
  CcvOptionsService,
} from "../../server/core/platform/services/CcvOptionsService";
import { EnvService } from "../../server/core/platform/services/EnvService";
import { UserConfigService } from "../../server/core/platform/services/UserConfigService";
import type { UserConfig } from "../../server/lib/config/config";

const claudeDirForTest = `${process.cwd()}/mock-global-claude-dir`;

export const testPlatformLayer = (overrides?: {
  claudeCodePaths?: Partial<ClaudeCodePaths>;
  env?: Partial<EnvSchema>;
  userConfig?: Partial<UserConfig>;
  ccvOptions?: Partial<CcvOptions>;
}) => {
  const applicationContextLayer = Layer.mock(ApplicationContext, {
    claudeCodePaths: Effect.succeed({
      globalClaudeDirectoryPath: claudeDirForTest,
      claudeCommandsDirPath: `${claudeDirForTest}/commands`,
      claudeSkillsDirPath: `${claudeDirForTest}/skills`,
      claudeAgentsDirPath: `${claudeDirForTest}/agents`,
      claudeProjectsDirPath: `${claudeDirForTest}/projects`,
      ...overrides?.claudeCodePaths,
    }),
  });

  const fullCcvOptions: CcvOptions = {
    port: 3000,
    hostname: "localhost",
    ...overrides?.ccvOptions,
  };

  const ccvOptionsServiceLayer = Layer.mock(CcvOptionsService, {
    getCcvOptions: <Key extends keyof CcvOptions>(key: Key) => Effect.succeed(fullCcvOptions[key]),
  });

  const fullEnv: EnvSchema = {
    CCV_ENV: overrides?.env?.CCV_ENV ?? "development",
    NEXT_PHASE: overrides?.env?.NEXT_PHASE ?? "phase-test",
    HOME: overrides?.env?.HOME ?? process.cwd(),
    USERPROFILE: overrides?.env?.USERPROFILE,
    PATH: overrides?.env?.PATH,
    SHELL: overrides?.env?.SHELL,
    CCV_TERMINAL_SHELL: overrides?.env?.CCV_TERMINAL_SHELL,
    CCV_TERMINAL_UNRESTRICTED: overrides?.env?.CCV_TERMINAL_UNRESTRICTED,
    CCV_TERMINAL_DISABLED: overrides?.env?.CCV_TERMINAL_DISABLED,
  };

  const envServiceLayer = Layer.mock(EnvService, {
    getEnv: <Key extends keyof EnvSchema>(key: Key) => Effect.succeed(fullEnv[key]),
  });

  const userConfigServiceLayer = Layer.mock(UserConfigService, {
    setUserConfig: () => Effect.succeed(undefined),
    getUserConfig: () =>
      Effect.succeed<UserConfig>({
        hideNoUserMessageSession: overrides?.userConfig?.hideNoUserMessageSession ?? true,
        unifySameTitleSession: overrides?.userConfig?.unifySameTitleSession ?? true,
        enterKeyBehavior: overrides?.userConfig?.enterKeyBehavior ?? "shift-enter-send",
        locale: overrides?.userConfig?.locale ?? DEFAULT_LOCALE,
        theme: overrides?.userConfig?.theme ?? "system",
        searchHotkey: overrides?.userConfig?.searchHotkey ?? "command-k",
        findHotkey: overrides?.userConfig?.findHotkey ?? "command-f",
        autoScheduleContinueOnRateLimit:
          overrides?.userConfig?.autoScheduleContinueOnRateLimit ?? false,
        modelChoices: overrides?.userConfig?.modelChoices ?? ["default", "haiku", "sonnet", "opus"],
      }),
  });

  return Layer.mergeAll(
    applicationContextLayer,
    userConfigServiceLayer,
    EventBus.Live,
    ccvOptionsServiceLayer,
    envServiceLayer,
    Path.layer,
  );
};
