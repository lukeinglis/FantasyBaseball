export function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function stddev(vals: number[], mu: number): number {
  if (vals.length < 2) return 1;
  const variance = vals.reduce((s, v) => s + (v - mu) ** 2, 0) / vals.length;
  return Math.sqrt(variance) || 1;
}
