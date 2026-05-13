import { describe, expect, test } from "vitest";
import {
  detectDefaultTerminal,
  isTerminalKey,
  TERMINAL_KEYS,
  terminalRegistry,
} from "./registry.ts";

describe("terminal registry", () => {
  test("every key has a spec", () => {
    for (const key of TERMINAL_KEYS) {
      expect(terminalRegistry[key]).toBeDefined();
      expect(terminalRegistry[key].platforms.length).toBeGreaterThan(0);
    }
  });

  test("wt spawn shape", () => {
    expect(terminalRegistry.wt.spawn("C:\\proj")).toEqual({
      exe: "wt.exe",
      args: ["-d", "C:\\proj"],
    });
  });

  test("cmd spawn shape", () => {
    expect(terminalRegistry.cmd.spawn("C:\\proj")).toEqual({
      exe: "cmd.exe",
      args: ["/K", 'cd /d "C:\\proj"'],
    });
  });

  test("terminal (macOS) spawn shape", () => {
    expect(terminalRegistry.terminal.spawn("/Users/x/p")).toEqual({
      exe: "open",
      args: ["-a", "Terminal", "/Users/x/p"],
    });
  });

  test("gnome-terminal spawn shape", () => {
    expect(terminalRegistry["gnome-terminal"].spawn("/home/x/p")).toEqual({
      exe: "gnome-terminal",
      args: ["--working-directory=/home/x/p"],
    });
  });

  test("powershell quotes single-quote in cwd", () => {
    const { args } = terminalRegistry.powershell.spawn("C:\\o'brien");
    expect(args[2]).toContain("'C:\\o''brien'");
  });

  test("detectDefaultTerminal per platform", () => {
    expect(detectDefaultTerminal("win32")).toBe("wt");
    expect(detectDefaultTerminal("darwin")).toBe("terminal");
    expect(detectDefaultTerminal("linux")).toBe("gnome-terminal");
    expect(detectDefaultTerminal("freebsd")).toBe("gnome-terminal");
  });

  test("isTerminalKey accepts known keys, rejects unknown", () => {
    expect(isTerminalKey("wt")).toBe(true);
    expect(isTerminalKey("cmd")).toBe(true);
    expect(isTerminalKey("malicious-shell")).toBe(false);
    expect(isTerminalKey("")).toBe(false);
  });
});
