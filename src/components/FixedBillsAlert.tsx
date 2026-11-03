"use client";

import React, { useMemo } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatFCFA, isInternalTransfer } from "@/lib/finance-utils";

const BILLS: { id: string; label: string; pattern: RegExp }[] = [
  { id: "loyer", label: "Loyer", pattern: /loyer/i },
  { id: "cie", label: "CIE (électricité)", pattern: /\bcie\b/i },
  { id: "sodeci", label: "SODECI (eau)", pattern: /sodeci/i },
  { id: "internet", label: "Internet", pattern: /fibre|internet|mtn\s*home|moov\s*fibre|canal/i },
];

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/**
 * Charges fixes du mois (loyer, CIE, SODECI, internet) : déjà payées ou pas encore, et « reste à vivre réel »
 * = solde total moins ce qu'il reste à payer, estimé d'après le dernier paiement connu de chaque charge.
 */
export default function FixedBillsAlert() {
  const { transactions, totalBalance } = useFinance();

  const rows = useMemo(() => {
    const now = new Date();
    const current = monthIndex(now);
    return BILLS.map((bill) => {
      const payments = transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            !isInternalTransfer(t) &&
            bill.pattern.test(`${t.title} ${t.party ?? ""} ${t.note ?? ""}`)
        )
        .map((t) => ({ amount: t.amount, month: monthIndex(new Date(t.date)), at: Date.parse(t.date) }))
        .filter((p) => p.month <= current && current - p.month <= 3)
        .sort((a, b) => b.at - a.at);
      if (payments.length === 0) return null;
      const paidNow = payments.filter((p) => p.month === current);
      const last = payments.find((p) => p.month < current);
      return {
        ...bill,
        paid: paidNow.length > 0,
        amount: paidNow.length > 0 ? paidNow.reduce((s, p) => s + p.amount, 0) : last?.amount ?? 0,
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
  }, [transactions]);

  if (rows.length === 0) return null;

  const unpaidTotal = rows.filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);
  const left = totalBalance - unpaidTotal;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4">
      <h3 className="text-sm font-bold text-white">Factures de fin de mois</h3>
      <ul className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-200">
              {r.paid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <Clock className="h-4 w-4 text-amber-400" />
              )}
              {r.label}
            </span>
            <span className={r.paid ? "font-semibold text-emerald-300" : "font-semibold text-amber-300"}>
              {r.paid ? `payé · ${formatFCFA(r.amount)}` : `à payer · ≈ ${formatFCFA(r.amount)}`}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl bg-slate-900/70 p-3">
        <p className="text-[11px] text-slate-400">Reste à vivre réel</p>
        <p className={`text-lg font-extrabold ${left < 0 ? "text-rose-400" : "text-emerald-300"}`}>{formatFCFA(left)}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Solde total {formatFCFA(totalBalance)}
          {unpaidTotal > 0 ? ` − factures restantes ≈ ${formatFCFA(unpaidTotal)} (d'après vos derniers paiements)` : " : toutes vos charges habituelles sont payées"}
        </p>
      </div>
    </div>
  );
}
