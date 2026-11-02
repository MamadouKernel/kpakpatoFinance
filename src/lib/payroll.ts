/**
 * Estimation du salaire net en Côte d'Ivoire avec heures supplémentaires (HS).
 *
 * ⚠️ Estimation indicative : les sources publiques ne s'accordent pas sur tous les taux
 * (majorations d'HS, tranches ITS). Les valeurs par défaut sont modifiables dans l'écran
 * « Revenus & Primes » ; le bulletin de paie et la convention collective font foi.
 */

/** Durée mensuelle de référence : 40 h/semaine × 52 / 12. */
export const MONTHLY_HOURS = 173.33;

/** Barème ITS mensuel appliqué par tranches sur le brut imposable (estimation). */
export const ITS_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 75_000, rate: 0 },
  { upTo: 240_000, rate: 0.16 },
  { upTo: 800_000, rate: 0.21 },
  { upTo: 2_400_000, rate: 0.24 },
  { upTo: 8_000_000, rate: 0.28 },
  { upTo: Infinity, rate: 0.32 },
];

export const CNPS_RATE = 0.063;
export const CNPS_CEILING = 3_375_000;
export const CMU_MONTHLY = 1_000;
/** Réduction d'impôt par demi-part supplémentaire (charges de famille), plafonnée à 5 parts. */
export const RICF_PER_HALF_PART = 5_500;
export const MAX_PARTS = 5;

export interface OvertimeRates {
  /** Premières heures supplémentaires (défaut +15 %). */
  first: number;
  /** Heures supplémentaires au-delà (défaut +50 %). */
  beyond: number;
  /** Heures de nuit (défaut +75 %). */
  night: number;
  /** Dimanche / jour férié (défaut +100 %). */
  holiday: number;
}

export const DEFAULT_OVERTIME_RATES: OvertimeRates = {
  first: 15,
  beyond: 50,
  night: 75,
  holiday: 100,
};

export interface PayrollInput {
  /** Salaire de base brut mensuel. */
  baseGross: number;
  /** Autres primes imposables du mois (ancienneté, rendement…). */
  taxableBonuses: number;
  hours: { first: number; beyond: number; night: number; holiday: number };
  rates: OvertimeRates;
  /** Nombre de parts fiscales (1 = célibataire, 2 = marié, +0,5 par enfant). */
  parts: number;
}

export interface PayrollResult {
  hourlyRate: number;
  overtimePay: number;
  overtimeHours: number;
  grossTotal: number;
  cnps: number;
  its: number;
  cmu: number;
  net: number;
}

const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function calcIts(taxableGross: number, parts = 1): number {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of ITS_BRACKETS) {
    if (taxableGross > lower) tax += (Math.min(taxableGross, upTo) - lower) * rate;
    lower = upTo;
  }
  const p = Math.min(MAX_PARTS, Math.max(1, parts));
  const ricf = ((p - 1) / 0.5) * RICF_PER_HALF_PART;
  return Math.max(0, Math.round(tax - ricf));
}

export function calcPayroll(input: PayrollInput): PayrollResult {
  const baseGross = nonNeg(input.baseGross);
  const hourlyRate = baseGross / MONTHLY_HOURS;
  const pay = (hours: number, ratePct: number) => nonNeg(hours) * hourlyRate * (1 + nonNeg(ratePct) / 100);

  const overtimePay = Math.round(
    pay(input.hours.first, input.rates.first) +
      pay(input.hours.beyond, input.rates.beyond) +
      pay(input.hours.night, input.rates.night) +
      pay(input.hours.holiday, input.rates.holiday)
  );
  const overtimeHours =
    nonNeg(input.hours.first) + nonNeg(input.hours.beyond) + nonNeg(input.hours.night) + nonNeg(input.hours.holiday);

  const grossTotal = Math.round(baseGross + nonNeg(input.taxableBonuses) + overtimePay);
  const cnps = Math.round(Math.min(grossTotal, CNPS_CEILING) * CNPS_RATE);
  const its = calcIts(grossTotal, input.parts);
  const cmu = grossTotal > 0 ? CMU_MONTHLY : 0;
  const net = Math.max(0, grossTotal - cnps - its - cmu);

  return { hourlyRate, overtimePay, overtimeHours, grossTotal, cnps, its, cmu, net };
}

/** Net d'un brut mensuel sans heures supplémentaires. */
export function netFromGross(gross: number, parts = 1): PayrollResult {
  return calcPayroll({
    baseGross: gross,
    taxableBonuses: 0,
    hours: { first: 0, beyond: 0, night: 0, holiday: 0 },
    rates: DEFAULT_OVERTIME_RATES,
    parts,
  });
}

/** Brut nécessaire pour obtenir un net donné (recherche par dichotomie, le net croît avec le brut). */
export function grossFromNet(targetNet: number, parts = 1): number {
  if (targetNet <= 0) return 0;
  let lo = targetNet;
  let hi = targetNet * 3 + 100_000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (netFromGross(mid, parts).net < targetNet) lo = mid;
    else hi = mid;
  }
  return Math.round(hi);
}
