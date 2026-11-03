import { filterTransactionsByPeriod, isInternalTransfer } from "@/lib/finance-utils";
import type { Transaction } from "@/types/finance";

export type TransportKind = "vtc" | "commun" | "peage" | "carburant" | "autre";

export const TRANSPORT_KIND_LABELS: Record<TransportKind, string> = {
  vtc: "Yango, Heetch, Uber",
  commun: "Gbaka, woro-woro, SOTRA",
  peage: "Péage et ponts (HKB, 4e pont)",
  carburant: "Carburant",
  autre: "Autres transports",
};

const RULES: { kind: TransportKind; re: RegExp }[] = [
  { kind: "peage", re: /p[eé]age|\bhkb\b|henri\s*konan|\bpont\b|4e\s*pont|quatri[eè]me\s*pont/i },
  { kind: "carburant", re: /carburant|essence|gasoil|gazoil|station|petroci|\bshell\b|\btotal(?:energies)?\b|\bcorlay\b/i },
  { kind: "vtc", re: /\byango\b|\bheetch\b|\buber\b|\bbolt\b|\bindrive\b/i },
  { kind: "commun", re: /gbaka|w[oô]r[oô]|sotra|\btaxi\b|\bbus\b|\bmoto\b|bateau|bac\b/i },
];

export const isTransportTx = (t: Transaction) =>
  t.type === "expense" && !isInternalTransfer(t) && (t.category === "Transport (Yango/Gbaka/Wôrô)" || RULES.some((r) => r.re.test(`${t.title} ${t.party ?? ""}`)));

export const transportKindOf = (t: Transaction): TransportKind =>
  RULES.find((r) => r.re.test(`${t.title} ${t.party ?? ""} ${t.note ?? ""}`))?.kind ?? "autre";

/** Un trajet en gbaka ou woro-woro coûte en général environ le tiers d'une course en VTC sur le même parcours (ordre de grandeur). */
export const COMMUN_VS_VTC = 1 / 3;

export interface TransportReport {
  total: number;
  count: number;
  byKind: { kind: TransportKind; amount: number; count: number }[];
  /** Économie possible si une part des courses en VTC passait en transport commun. */
  savings: { sharePct: number; amount: number }[];
}

export function analyzeTransport(transactions: Transaction[], period: "month" | "week" = "month"): TransportReport {
  const rows = filterTransactionsByPeriod(transactions, period).filter(isTransportTx);
  const map = new Map<TransportKind, { amount: number; count: number }>();
  for (const t of rows) {
    const k = transportKindOf(t);
    const cur = map.get(k) ?? { amount: 0, count: 0 };
    map.set(k, { amount: cur.amount + t.amount, count: cur.count + 1 });
  }
  const byKind = Array.from(map, ([kind, v]) => ({ kind, ...v })).sort((a, b) => b.amount - a.amount);
  const vtc = map.get("vtc")?.amount ?? 0;
  return {
    total: rows.reduce((s, t) => s + t.amount, 0),
    count: rows.length,
    byKind,
    savings: [25, 50, 75].map((sharePct) => ({ sharePct, amount: Math.round(((vtc * sharePct) / 100) * (1 - COMMUN_VS_VTC)) })),
  };
}
