import { TERMINAL_KEYS, type TerminalKey } from "../../../lib/terminal-launcher/keys.ts";

export { TERMINAL_KEYS, type TerminalKey };

export const isTerminalKey = (value: string): value is TerminalKey =>
  (TERMINAL_KEYS as readonly string[]).includes(value);

export type TerminalSpec = {
  readonly platforms: ReadonlyArray<NodeJS.Platform>;
  readonly spawn: (cwd: string) => { exe: string; args: string[] };
};

export const terminalRegistry: Record<TerminalKey, TerminalSpec> = {
  wt: {
    platforms: ["win32"],
    spawn: (cwd) => ({ exe: "wt.exe", args: ["-d", cwd] }),
  },
  cmd: {
    platforms: ["win32"],
    spawn: (cwd) => ({ exe: "cmd.exe", args: ["/K", `cd /d "${cwd}"`] }),
  },
  powershell: {
    platforms: ["win32"],
    spawn: (cwd) => ({
      exe: "powershell.exe",
      args: ["-NoExit", "-Command", `Set-Location -LiteralPath '${cwd.replaceAll("'", "''")}'`],
    }),
  },
  pwsh: {
    platforms: ["win32", "darwin", "linux"],
    spawn: (cwd) => ({
      exe: "pwsh",
      args: ["-NoExit", "-Command", `Set-Location -LiteralPath '${cwd.replaceAll("'", "''")}'`],
    }),
  },
  cmder: {
    platforms: ["win32"],
    spawn: (cwd) => ({ exe: "Cmder.exe", args: ["/START", cwd] }),
  },
  terminal: {
    platforms: ["darwin"],
    spawn: (cwd) => ({ exe: "open", args: ["-a", "Terminal", cwd] }),
  },
  iterm: {
    platforms: ["darwin"],
    spawn: (cwd) => ({ exe: "open", args: ["-a", "iTerm", cwd] }),
  },
  alacritty: {
    platforms: ["win32", "darwin", "linux"],
    spawn: (cwd) => ({ exe: "alacritty", args: ["--working-directory", cwd] }),
  },
  wezterm: {
    platforms: ["win32", "darwin", "linux"],
    spawn: (cwd) => ({ exe: "wezterm", args: ["start", "--cwd", cwd] }),
  },
  kitty: {
    platforms: ["darwin", "linux"],
    spawn: (cwd) => ({ exe: "kitty", args: ["--directory", cwd] }),
  },
  "gnome-terminal": {
    platforms: ["linux"],
    spawn: (cwd) => ({ exe: "gnome-terminal", args: [`--working-directory=${cwd}`] }),
  },
  konsole: {
    platforms: ["linux"],
    spawn: (cwd) => ({ exe: "konsole", args: ["--workdir", cwd] }),
  },
  xterm: {
    platforms: ["linux"],
    spawn: (cwd) => ({ exe: "xterm", args: ["-e", `cd "${cwd}" && $SHELL`] }),
  },
};

export const detectDefaultTerminal = (platform: NodeJS.Platform): TerminalKey => {
  if (platform === "win32") return "wt";
  if (platform === "darwin") return "terminal";
  return "gnome-terminal";
};
