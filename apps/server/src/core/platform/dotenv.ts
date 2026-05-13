const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const stripQuotes = (value: string): string => {
  if (value.length >= 2) {
    const first = value.charAt(0);
    const last = value.charAt(value.length - 1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
};

export const parseDotEnv = (input: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!KEY_PATTERN.test(key)) continue;
    const value = stripQuotes(line.slice(eq + 1).trim());
    out[key] = value;
  }
  return out;
};

export type DotEnvFileReader = (path: string) => Promise<string | undefined>;

export const loadDotEnv = async (
  path: string,
  read: DotEnvFileReader,
): Promise<Record<string, string>> => {
  const content = await read(path);
  if (content === undefined) return {};
  return parseDotEnv(content);
};

export const applyDotEnvToProcess = (
  values: Record<string, string>,
  env: NodeJS.ProcessEnv,
): string[] => {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (env[key] === undefined || env[key] === "") {
      env[key] = value;
      applied.push(key);
    }
  }
  return applied;
};
