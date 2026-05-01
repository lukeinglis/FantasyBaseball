/**
 * Monte Carlo simulation for H2H category win probability.
 *
 * Models remaining variance as N(0, dailySd * sqrt(daysRemaining)) for each team
 * independently, using Box-Muller to generate normal samples.
 * Ties count as losses (standard H2H scoring).
 */
export function simulateCategoryWinProb(
  myProj: number,
  oppProj: number,
  dailySd: number,
  daysRemaining: number,
  lowerIsBetter: boolean
): number {
  if (
    !Number.isFinite(myProj) ||
    !Number.isFinite(oppProj) ||
    !Number.isFinite(dailySd) ||
    !Number.isFinite(daysRemaining)
  ) {
    return 50;
  }

  if (daysRemaining <= 0) {
    if (lowerIsBetter) return myProj < oppProj ? 100 : myProj > oppProj ? 0 : 50;
    return myProj > oppProj ? 100 : myProj < oppProj ? 0 : 50;
  }

  const sd = dailySd * Math.sqrt(daysRemaining);
  if (!Number.isFinite(sd) || sd === 0) {
    if (lowerIsBetter) return myProj < oppProj ? 100 : myProj > oppProj ? 0 : 50;
    return myProj > oppProj ? 100 : myProj < oppProj ? 0 : 50;
  }

  const ITERATIONS = 5000;
  let wins = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    // Box-Muller: two uniform samples → two independent standard normals
    const u1 = Math.random() || Number.EPSILON;
    const u2 = Math.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    const myFinal = myProj + r * Math.cos(theta) * sd;
    const oppFinal = oppProj + r * Math.sin(theta) * sd;

    const iWin = lowerIsBetter ? myFinal < oppFinal : myFinal > oppFinal;
    if (iWin) wins++;
  }

  return Math.round((wins / ITERATIONS) * 100);
}
