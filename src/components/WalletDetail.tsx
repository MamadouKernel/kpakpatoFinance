"use client";

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { filterTransactionsByPeriod, formatFCFA, isInternalTransfer } from "@/lib/finance-utils";
import type { ExpenseSubtype, PeriodFilter, WalletId } from "@/types/finance";

const PERIODS: { id: PeriodFilter; label: string }[] = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "month", label: "Mois" },
];

const SUBTYPES: { id: ExpenseSubtype | "autre"; label: string }[] = [
  { id: "transfert", label: "Transferts" },
  { id: "retrait", label: "Retraits" },
  { id: "paiement", label: "Paiements" },
  { id: "autre", label: "Autres" },
];

/** Détail d'un portefeuille : solde en direct, entrées / dépôts et dépenses (transferts, retraits, paiements) par période. */
export default function WalletDetail({ walletId, onClose }: { walletId: WalletId; onClose: () => void }) {
  const { wallets, transactions } = useFinance();
  const wallet = wallets.find((w) => w.id === walletId);
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [tab, setTab] = useState<"income" | "expense">("income");
  const [sub, setSub] = useState<ExpenseSubtype | "autre" | "all">("all");

  const { incomes, expenses, incomeTotal, expenseTotal, bySubtype } = useMemo(() => {
    const own = filterTransactionsByPeriod(
      transactions.filter((t) => t.walletId === walletId && !isInternalTransfer(t)),
      period
    );
    const incomes = own.filter((t) => t.type === "income");
    const expenses = own.filter((t) => t.type === "expense");
    const bySubtype: Record<string, number> = { transfert: 0, retrait: 0, paiement: 0, autre: 0 };
    for (const t of expenses) bySubtype[t.subtype ?? "autre"] += t.amount;
    return {
      incomes,
      expenses,
      incomeTotal: incomes.reduce((s, t) => s + t.amount, 0),
      expenseTotal: expenses.reduce((s, t) => s + t.amount, 0),
      bySubtype,
    };
  }, [transactions, walletId, period]);

  if (!wallet) return null;

  const list =
    tab === "income" ? incomes : expenses.filter((t) => sub === "all" || (t.subtype ?? "autre") === sub);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 sm:items-center sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Détail ${wallet.shortName}`}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">{wallet.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" title="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className={`mt-3 rounded-2xl bg-gradient-to-br ${wallet.bgGradient} p-4 ${wallet.textColor}`}>
          <p className="text-xs font-semibold opacity-85">Solde actuel</p>
          <p className="text-2xl font-extrabold tracking-tight">{formatFCFA(wallet.balance)}</p>
        </div>

        <div className="mt-4 flex gap-1 rounded-xl bg-slate-800 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                period === p.id ? "bg-kpakpato-orange text-white" : "text-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("income")}
            className={`rounded-xl border p-3 text-left ${
              tab === "income" ? "border-emerald-400 bg-emerald-500/10" : "border-slate-700"
            }`}
          >
            <p className="text-[11px] font-semibold text-emerald-300">Entrées / Dépôts</p>
            <p className="text-sm font-extrabold text-white">+{formatFCFA(incomeTotal)}</p>
          </button>
          <button
            onClick={() => setTab("expense")}
            className={`rounded-xl border p-3 text-left ${
              tab === "expense" ? "border-rose-400 bg-rose-500/10" : "border-slate-700"
            }`}
          >
            <p className="text-[11px] font-semibold text-rose-300">Dépenses</p>
            <p className="text-sm font-extrabold text-white">-{formatFCFA(expenseTotal)}</p>
          </button>
        </div>

        {tab === "expense" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setSub("all")}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                sub === "all" ? "bg-kpakpato-orange text-white" : "bg-slate-800 text-slate-300"
              }`}
            >
              Tout
            </button>
            {SUBTYPES.filter((s) => bySubtype[s.id] > 0).map((s) => (
              <button
                key={s.id}
                onClick={() => setSub(s.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  sub === s.id ? "bg-kpakpato-orange text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {s.label} · {formatFCFA(bySubtype[s.id])}
              </button>
            ))}
          </div>
        )}

        <ul className="mt-3 space-y-2">
          {list.length === 0 && (
            <li className="rounded-xl bg-slate-800/60 p-4 text-center text-xs text-slate-400">
              Aucune opération sur cette période.
            </li>
          )}
          {list.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{t.title}</p>
                <p className="text-[11px] text-slate-400">
                  {new Date(t.date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {t.subtype ? ` · ${t.subtype}` : ""}
                </p>
              </div>
              <p className={`shrink-0 text-xs font-extrabold ${t.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                {t.type === "income" ? "+" : "-"}
                {formatFCFA(t.amount)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
