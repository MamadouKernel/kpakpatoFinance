import { grossFromNet, netFromGross } from "@/lib/payroll";
import {
  CommuneRentGuide,
  PeriodFilter,
  Transaction,
  Transfer,
  WalletId,
  WalletInfo,
} from "@/types/finance";

export const DEFAULT_WALLETS: WalletInfo[] = [
  {
    id: "wave",
    name: "Wave Côte d'Ivoire",
    shortName: "Wave",
    color: "#1DC4FF",
    bgGradient: "from-[#1DC4FF] to-[#0284C7]",
    textColor: "text-white",
    balance: 0,
    feeNote: "1% frais de transfert • Paiement marchand 0 FCFA",
  },
  {
    id: "orange",
    name: "Orange Money",
    shortName: "Orange Money",
    color: "#FF7900",
    bgGradient: "from-[#FF7900] to-[#EA580C]",
    textColor: "text-white",
    balance: 0,
    feeNote: "Pratique pour factures CIE/SODECI & Pass Internet",
  },
  {
    id: "mtn",
    name: "MTN MoMo",
    shortName: "MTN MoMo",
    color: "#FFCC00",
    bgGradient: "from-[#FFCC00] to-[#EAB308]",
    textColor: "text-slate-950",
    balance: 0,
    feeNote: "Momopay & avances rapides",
  },
  {
    id: "moov",
    name: "Moov Money",
    shortName: "Moov Money",
    color: "#0055A5",
    bgGradient: "from-[#0055A5] to-[#1D4ED8]",
    textColor: "text-white",
    balance: 0,
    feeNote: "Transferts nationaux & forfaits Moov",
  },
  {
    id: "djamo",
    name: "Djamo (Coffres & Carte)",
    shortName: "Djamo",
    color: "#111827",
    bgGradient: "from-[#1E293B] to-[#0F172A]",
    textColor: "text-white",
    balance: 0,
    feeNote: "Idéal pour Coffres d'épargne & abonnements en ligne",
  },
  {
    id: "cash",
    name: "Espèces (Cash / Poche)",
    shortName: "Cash",
    color: "#10B981",
    bgGradient: "from-[#10B981] to-[#059669]",
    textColor: "text-white",
    balance: 0,
    feeNote: "Monnaie gbaka, wôrô-wôrô, garbadrome & marché",
  },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const ABIDJAN_COMMUNES_RENT: CommuneRentGuide[] = [
  {
    commune: "Yopougon (Niangon, Maroc, Toits Rouges)",
    vibe: "Populaire, vivant, très bon rapport surface/prix",
    studioAvg: 45000,
    deuxPiecesAvg: 75000,
    troisPiecesAvg: 120000,
    transportAvgMonthly: 35000,
    advice:
      "Excellent pour débuter et épargner ! Prévois le budget transport (4e pont / Gbaka / Wôrô) si tu travailles au Plateau ou à Marcory.",
  },
  {
    commune: "Cocody (Angré, Riviera Palmeraie, Bonoumin)",
    vibe: "Résidentiel, calme, proche des nouveaux pôles",
    studioAvg: 85000,
    deuxPiecesAvg: 150000,
    troisPiecesAvg: 240000,
    transportAvgMonthly: 25000,
    advice:
      "Confortable mais attention à ne pas dépasser 30% de ton salaire net juste pour dire « j'habite à Angré » !",
  },
  {
    commune: "Koumassi (Remblais, Prodomo, 05)",
    vibe: "Bien aménagé, proche Zone 4 / Marcory",
    studioAvg: 55000,
    deuxPiecesAvg: 95000,
    troisPiecesAvg: 150000,
    transportAvgMonthly: 22000,
    advice:
      "Stratégique si tu bosses à Marcory, Zone 4, Treichville ou au Plateau. Les loyers ont monté mais restent gérables.",
  },
  {
    commune: "Marcory (Résidentiel, Champroux, Anoumabo)",
    vibe: "Central, très connecté aux zones d'affaires",
    studioAvg: 75000,
    deuxPiecesAvg: 135000,
    troisPiecesAvg: 210000,
    transportAvgMonthly: 18000,
    advice:
      "Tu économises énormément en transport et en fatigue dans les embouteillages, mais les cautions et loyers sont élevés.",
  },
  {
    commune: "Abobo (PK18, Dokui, Plateau Dokui)",
    vibe: "Accessible, idéal pour petits budgets & forte épargne",
    studioAvg: 35000,
    deuxPiecesAvg: 60000,
    troisPiecesAvg: 95000,
    transportAvgMonthly: 32000,
    advice:
      "Dokui / Vallon offre un bon compromis proche de Cocody/Zoo pour réduire drastiquement le poids du loyer.",
  },
  {
    commune: "Bingerville (Nouvelle Gare, Faya, Cité)",
    vibe: "En plein boom immobilier, aéré, maisons neuves",
    studioAvg: 60000,
    deuxPiecesAvg: 100000,
    troisPiecesAvg: 160000,
    transportAvgMonthly: 35000,
    advice:
      "Logements neufs à bon prix, mais calcule bien le coût du carburant ou des wôrô-wôrô vers Palmeraie/Plateau.",
  },
];

export const INTERNAL_CATEGORY = "Virement interne au foyer" as const;

/** Un virement entre conjoints ne doit fausser ni les dépenses ni les revenus. */
export const isInternalTransfer = (tx: { category: string }) => tx.category === INTERNAL_CATEGORY;

export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-CI", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(Math.round(amount)) + " FCFA";
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  period: PeriodFilter
): Transaction[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    if (period === "day") {
      return txDate >= startOfToday;
    }
    if (period === "week") {
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      return txDate >= sevenDaysAgo;
    }
    if (period === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return txDate >= startOfMonth;
    }
    return true;
  });
}

/**
 * Calcule une estimation réaliste du Salaire Net en Côte d'Ivoire à partir du Brut
 * (CNPS retraite 6.3% plafonné, CMU 1000 FCFA, estimation ITS barème progressif CI)
 */
export interface IvorianSalaryCalculation {
  brut: number;
  net: number;
  cnps: number;
  its: number;
  cmu: number;
  maxRecommendedRent: number;
  recommendedSavings: number;
  essentialNeeds: number;
}

export function calculateIvorianSalary(
  amount: number,
  mode: "brutToNet" | "netToBrut"
): IvorianSalaryCalculation {
  const brut = mode === "brutToNet" ? Math.max(0, amount) : grossFromNet(Math.max(0, amount));
  const r = netFromGross(brut);
  // En mode net → brut, on garde exactement le net demandé (l'arrondi du brut peut l'écarter de 1 FCFA).
  const net = mode === "netToBrut" ? Math.max(0, amount) : r.net;
  return {
    brut,
    net,
    cnps: r.cnps,
    its: r.its,
    cmu: r.cmu,
    maxRecommendedRent: Math.round(net * 0.3),
    recommendedSavings: Math.round(net * 0.2),
    essentialNeeds: Math.round(net * 0.5),
  };
}

// ---------------------------------------------------------------------------
// Identifiants, validation des données persistées et fusion cloud/local
// ---------------------------------------------------------------------------

export function generateId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

const WALLET_IDS: WalletId[] = DEFAULT_WALLETS.map((w) => w.id);
const TX_TYPES = ["expense", "income"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function isPositiveAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Réconcilie des portefeuilles lus (localStorage/Firestore) avec les 6 portefeuilles par défaut. */
export function sanitizeWallets(raw: unknown): WalletInfo[] {
  const saved = Array.isArray(raw) ? raw.filter(isRecord) : [];
  return DEFAULT_WALLETS.map((def) => {
    const match = saved.find((w) => w.id === def.id);
    const balance =
      match && typeof match.balance === "number" && Number.isFinite(match.balance)
        ? Math.round(match.balance)
        : def.balance;
    return { ...def, balance };
  });
}

export function sanitizeTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is Transaction =>
      isRecord(t) &&
      typeof t.id === "string" &&
      typeof t.title === "string" &&
      isPositiveAmount(t.amount) &&
      typeof t.type === "string" &&
      TX_TYPES.includes(t.type) &&
      typeof t.category === "string" &&
      typeof t.walletId === "string" &&
      WALLET_IDS.includes(t.walletId as WalletId) &&
      isValidDate(t.date)
  );
}

export function sanitizeTransfers(raw: unknown): Transfer[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is Transfer =>
      isRecord(t) &&
      typeof t.id === "string" &&
      isPositiveAmount(t.amount) &&
      typeof t.fromWalletId === "string" &&
      WALLET_IDS.includes(t.fromWalletId as WalletId) &&
      typeof t.toWalletId === "string" &&
      WALLET_IDS.includes(t.toWalletId as WalletId) &&
      t.fromWalletId !== t.toWalletId &&
      isValidDate(t.date)
  );
}

/** Effet d'une transaction sur le solde de son portefeuille. */
export function transactionDelta(tx: Transaction): number {
  return tx.type === "income" ? tx.amount : -tx.amount;
}

/**
 * Fusionne l'état cloud et l'état local à la connexion : les soldes cloud servent
 * de base, et les opérations présentes uniquement en local (saisies hors ligne)
 * y sont ajoutées sans rien écraser.
 */
export function mergeCloudAndLocal(
  cloud: { wallets: WalletInfo[]; transactions: Transaction[]; transfers: Transfer[] },
  local: { transactions: Transaction[]; transfers: Transfer[] }
): { wallets: WalletInfo[]; transactions: Transaction[]; transfers: Transfer[] } {
  const cloudTxIds = new Set(cloud.transactions.map((t) => t.id));
  const cloudTransferIds = new Set(cloud.transfers.map((t) => t.id));
  const localOnlyTx = local.transactions.filter((t) => !cloudTxIds.has(t.id));
  const localOnlyTransfers = local.transfers.filter((t) => !cloudTransferIds.has(t.id));

  const deltas = new Map<WalletId, number>();
  const bump = (id: WalletId, d: number) => deltas.set(id, (deltas.get(id) ?? 0) + d);
  localOnlyTx.forEach((t) => bump(t.walletId, transactionDelta(t)));
  localOnlyTransfers.forEach((t) => {
    bump(t.fromWalletId, -t.amount);
    bump(t.toWalletId, t.amount);
  });

  return {
    wallets: cloud.wallets.map((w) => ({ ...w, balance: w.balance + (deltas.get(w.id) ?? 0) })),
    transactions: [...localOnlyTx, ...cloud.transactions],
    transfers: [...localOnlyTransfers, ...cloud.transfers],
  };
}

/** Convertit une saisie utilisateur en montant FCFA entier, ou null si invalide. */
export function parseFcfaInput(value: string): number | null {
  const trimmed = value.replace(/\s/g, "").replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n) : null;
}
