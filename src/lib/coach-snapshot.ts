import type { SalaryProfile } from "@/context/SalaryContext";
import { filterTransactionsByPeriod, isInternalTransfer } from "@/lib/finance-utils";
import { debtProgress, forecastCie, monthKey, tontineMemberStatus, type LifestyleData } from "@/lib/lifestyle";
import { analyzeMeals } from "@/lib/meal-analysis";
import { netFromGross } from "@/lib/payroll";
import { rentCap } from "@/lib/abidjan-data";
import { analyzeTransport } from "@/lib/transport-analysis";
import type { Transaction, WalletInfo } from "@/types/finance";

/** Résumé chiffré de la situation de l'utilisateur : envoyé au modèle IA et utilisé par le moteur local. */
export interface FinanceSnapshot {
  wallets: { id: string; name: string; balance: number }[];
  total: number;
  month: {
    income: number;
    expense: number;
    byCategory: { category: string; amount: number }[];
    fees: number;
    transport: number;
    transportYango: number;
    food: number;
    fastFood: number;
  };
  salary: { fixedNet: number; rentCap: number; overtimeNetGain: number; overtimeHours: number } | null;
  debts: { owedToMe: number; iOwe: number; openCount: number; oldestOwedTo: string | null };
  cie: { daysLeft: number | null; ratePerDay: number | null; level: string } | null;
  tontine: { pendingMembers: number; groups: string[] };
  /** Opérations en espèces notées ce mois-ci. */
  cashSpent: number;
}

export const EMPTY_SNAPSHOT: FinanceSnapshot = {
  wallets: [],
  total: 0,
  month: { income: 0, expense: 0, byCategory: [], fees: 0, transport: 0, transportYango: 0, food: 0, fastFood: 0 },
  salary: null,
  debts: { owedToMe: 0, iOwe: 0, openCount: 0, oldestOwedTo: null },
  cie: null,
  tontine: { pendingMembers: 0, groups: [] },
  cashSpent: 0,
};

export function buildSnapshot(
  wallets: WalletInfo[],
  transactions: Transaction[],
  salary: SalaryProfile,
  lifestyle: LifestyleData
): FinanceSnapshot {
  const month = filterTransactionsByPeriod(transactions, "month").filter((t) => !isInternalTransfer(t));
  const expenses = month.filter((t) => t.type === "expense");
  const cats = new Map<string, number>();
  for (const t of expenses) cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);

  const meals = analyzeMeals(transactions, salary);
  const transport = analyzeTransport(transactions, "month");
  const fixedNet = netFromGross(salary.baseGross + salary.taxableBonuses, salary.parts).net;

  const debts = lifestyle.debts.map((d) => ({ d, ...debtProgress(d, transactions) })).filter((r) => !r.settled);
  const oldest = debts.filter((r) => r.d.kind === "owed_to_me").sort((a, b) => a.d.createdAt.localeCompare(b.d.createdAt))[0];

  const forecast = forecastCie(transactions, lifestyle.cie);
  const now = monthKey(new Date());
  const pending = lifestyle.tontines.map((t) => ({
    name: t.name,
    waiting: t.members.filter((m) => !tontineMemberStatus(t, m, now, transactions).paid).length,
  }));

  return {
    wallets: wallets.map((w) => ({ id: w.id, name: w.shortName, balance: w.balance })),
    total: wallets.reduce((s, w) => s + w.balance, 0),
    month: {
      income: month.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expense: expenses.reduce((s, t) => s + t.amount, 0),
      byCategory: Array.from(cats, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount).slice(0, 6),
      fees: cats.get("Frais & Commissions") ?? 0,
      transport: transport.total,
      transportYango: transport.byKind.find((k) => k.kind === "vtc")?.amount ?? 0,
      food: meals.foodTotal,
      fastFood: meals.fastFoodTotal,
    },
    salary:
      salary.baseGross > 0
        ? { fixedNet, rentCap: rentCap(fixedNet), overtimeNetGain: Math.round(meals.overtimeNetGain), overtimeHours: meals.overtimeHours }
        : null,
    debts: {
      owedToMe: debts.filter((r) => r.d.kind === "owed_to_me").reduce((s, r) => s + r.remaining, 0),
      iOwe: debts.filter((r) => r.d.kind === "i_owe").reduce((s, r) => s + r.remaining, 0),
      openCount: debts.length,
      oldestOwedTo: oldest?.d.person ?? null,
    },
    cie: forecast.level === "unknown" ? null : { daysLeft: forecast.daysLeft, ratePerDay: forecast.ratePerDay, level: forecast.level },
    tontine: { pendingMembers: pending.reduce((s, p) => s + p.waiting, 0), groups: pending.filter((p) => p.waiting > 0).map((p) => p.name) },
    cashSpent: expenses.filter((t) => t.walletId === "cash").reduce((s, t) => s + t.amount, 0),
  };
}
