const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const formatted = unit === 0 ? value.toFixed(0) : value.toFixed(value >= 10 ? 1 : 2);
  return `${formatted} ${UNITS[unit]}`;
};
