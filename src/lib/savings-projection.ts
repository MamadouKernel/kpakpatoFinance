export interface ProjectionPoint {
  month: number;
  balance: number;
}

/** Capital cumulé mois par mois : versement en fin de mois, intérêts composés mensuellement. */
export function projectSavings(initial: number, monthly: number, annualRatePct: number, months = 36): ProjectionPoint[] {
  const i = annualRatePct / 100 / 12;
  const points: ProjectionPoint[] = [{ month: 0, balance: Math.round(initial) }];
  let balance = initial;
  for (let m = 1; m <= months; m++) {
    balance = balance * (1 + i) + monthly;
    points.push({ month: m, balance: Math.round(balance) });
  }
  return points;
}

/** Premier mois où le capital atteint l'objectif (recherche jusqu'à 10 ans), ou null. */
export function monthsToReach(target: number, initial: number, monthly: number, annualRatePct: number): number | null {
  if (target <= initial) return 0;
  if (monthly <= 0 && annualRatePct <= 0) return null;
  const i = annualRatePct / 100 / 12;
  let balance = initial;
  for (let m = 1; m <= 120; m++) {
    balance = balance * (1 + i) + monthly;
    if (balance >= target) return m;
  }
  return null;
}
