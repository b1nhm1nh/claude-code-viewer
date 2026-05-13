export const TERMINAL_KEYS = [
  "wt",
  "cmd",
  "powershell",
  "pwsh",
  "cmder",
  "terminal",
  "iterm",
  "alacritty",
  "wezterm",
  "kitty",
  "gnome-terminal",
  "konsole",
  "xterm",
] as const;

export type TerminalKey = (typeof TERMINAL_KEYS)[number];

export type TerminalChoice = {
  value: TerminalKey;
  label: string;
};

export const TERMINAL_CHOICES: ReadonlyArray<TerminalChoice> = [
  { value: "wt", label: "Windows Terminal (wt)" },
  { value: "cmd", label: "Command Prompt (cmd)" },
  { value: "powershell", label: "PowerShell" },
  { value: "pwsh", label: "PowerShell 7+ (pwsh)" },
  { value: "cmder", label: "Cmder" },
  { value: "terminal", label: "macOS Terminal" },
  { value: "iterm", label: "iTerm" },
  { value: "alacritty", label: "Alacritty" },
  { value: "wezterm", label: "WezTerm" },
  { value: "kitty", label: "kitty" },
  { value: "gnome-terminal", label: "GNOME Terminal" },
  { value: "konsole", label: "Konsole" },
  { value: "xterm", label: "xterm" },
];
