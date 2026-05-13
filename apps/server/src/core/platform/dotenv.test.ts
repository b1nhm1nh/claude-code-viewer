import { describe, expect, test } from "vitest";
import { applyDotEnvToProcess, loadDotEnv, parseDotEnv } from "./dotenv.ts";

describe("parseDotEnv", () => {
  test("parses simple KEY=VALUE pairs", () => {
    expect(parseDotEnv("FOO=bar\nBAZ=qux")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  test("ignores blank lines and comments", () => {
    const input = `
# this is a comment
FOO=bar

  # indented comment
BAZ=qux
`;
    expect(parseDotEnv(input)).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  test("trims surrounding whitespace around key and value", () => {
    expect(parseDotEnv("  FOO  =  bar  ")).toEqual({ FOO: "bar" });
  });

  test("strips matching surrounding quotes from value", () => {
    expect(parseDotEnv(`FOO="hello world"\nBAR='single'`)).toEqual({
      FOO: "hello world",
      BAR: "single",
    });
  });

  test("keeps embedded = inside value", () => {
    expect(parseDotEnv("URL=postgres://u:p@host/db?x=1")).toEqual({
      URL: "postgres://u:p@host/db?x=1",
    });
  });

  test("skips lines without =", () => {
    expect(parseDotEnv("FOO=bar\nNOT_A_PAIR\nBAZ=qux")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  test("skips invalid key names", () => {
    expect(parseDotEnv("1FOO=bar\nVALID=ok\nFOO BAR=x")).toEqual({ VALID: "ok" });
  });

  test("later occurrence wins on duplicate keys", () => {
    expect(parseDotEnv("FOO=one\nFOO=two")).toEqual({ FOO: "two" });
  });

  test("returns empty object for empty input", () => {
    expect(parseDotEnv("")).toEqual({});
  });
});

describe("loadDotEnv", () => {
  test("returns empty record when reader returns undefined", async () => {
    const out = await loadDotEnv("/missing", () => Promise.resolve(undefined));
    expect(out).toEqual({});
  });

  test("passes the path through to the reader and parses content", async () => {
    let received = "";
    const out = await loadDotEnv("/tmp/.env", (path) => {
      received = path;
      return Promise.resolve("FOO=bar\nBAZ=qux\n");
    });
    expect(received).toBe("/tmp/.env");
    expect(out).toEqual({ FOO: "bar", BAZ: "qux" });
  });
});

describe("applyDotEnvToProcess", () => {
  test("sets variables that are unset", () => {
    const env: NodeJS.ProcessEnv = {};
    const applied = applyDotEnvToProcess({ FOO: "bar", BAZ: "qux" }, env);
    expect(env).toEqual({ FOO: "bar", BAZ: "qux" });
    expect(applied.sort()).toEqual(["BAZ", "FOO"]);
  });

  test("does not override variables that are already set", () => {
    const env: NodeJS.ProcessEnv = { FOO: "existing" };
    const applied = applyDotEnvToProcess({ FOO: "new", BAR: "added" }, env);
    expect(env).toEqual({ FOO: "existing", BAR: "added" });
    expect(applied).toEqual(["BAR"]);
  });

  test("treats empty string as unset and overrides it", () => {
    const env: NodeJS.ProcessEnv = { FOO: "" };
    const applied = applyDotEnvToProcess({ FOO: "filled" }, env);
    expect(env).toEqual({ FOO: "filled" });
    expect(applied).toEqual(["FOO"]);
  });
});
