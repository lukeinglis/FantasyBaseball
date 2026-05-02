export function computePercentile(
  playerZ: number,
  allZValues: number[],
): number {
  if (allZValues.length === 0) return 0;
  const below = allZValues.filter((z) => z < playerZ).length;
  return Math.round((below / allZValues.length) * 100);
}

export type TrendDirection = "up" | "down" | "flat" | "nodata";

export function trendDirection(points: (number | undefined | null)[]): TrendDirection {
  const valid = points.filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (valid.length < 2) return "nodata";

  const first = valid[0];
  const last = valid[valid.length - 1];
  const diff = last - first;
  const range = Math.max(...valid) - Math.min(...valid);

  if (range === 0) return "flat";
  const threshold = range * 0.1;
  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "flat";
}

export function safeNum(val: number | undefined | null): number {
  if (val == null || !Number.isFinite(val)) return 0;
  return val;
}
