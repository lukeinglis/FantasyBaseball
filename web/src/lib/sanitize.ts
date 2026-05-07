export function sanitizeNum(val: unknown, fallback: number = 0): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return val;
}

export function formatStat(val: unknown, decimals: number = 1): string {
  if (typeof val !== "number" || !Number.isFinite(val)) return "-";
  return val.toFixed(decimals);
}

export function safeDivide(num: number, den: number, fallback: number = 0): number {
  if (den === 0 || !Number.isFinite(num) || !Number.isFinite(den)) return fallback;
  const result = num / den;
  if (!Number.isFinite(result)) return fallback;
  return result;
}
