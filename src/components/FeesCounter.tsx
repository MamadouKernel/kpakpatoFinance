"use client";

import React, { useMemo } from "react";
import { Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatFCFA } from "@/lib/finance-utils";

const FEES_CATEGORY = "Frais & Commissions";
const MONTHS_SHOWN = 6;

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

/** Total des frais Mobile Money (retraits, transferts, commissions) payés chaque mois. */
export default function FeesCounter() {
  const { transactions, wallets } = useFinance();

  const data = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: MONTHS_SHOWN }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - i), 1);
      return {
        key: monthKey(d),
        label: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
        total: 0,
      };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    const currentByWallet = new Map<string, number>();
    let currentCount = 0;

    for (const t of transactions) {
      if (t.type !== "expense" || t.category !== FEES_CATEGORY) continue;
      const d = new Date(t.date);
      const bucket = byKey.get(monthKey(d));
      if (!bucket) continue;
      bucket.total += t.amount;
      if (bucket.key === monthKey(now)) {
        currentByWallet.set(t.walletId, (currentByWallet.get(t.walletId) ?? 0) + t.amount);
        currentCount += 1;
      }
    }

    const current = months[months.length - 1].total;
    const previous = months[months.length - 2].total;
    const max = Math.max(1, ...months.map((m) => m.total));
    const perWallet = wallets
      .map((w) => ({ id: w.id, name: w.shortName, color: w.color, total: currentByWallet.get(w.id) ?? 0 }))
      .filter((w) => w.total > 0)
      .sort((a, b) => b.total - a.total);

    return { months, current, previous, max, perWallet, currentCount };
  }, [transactions, wallets]);

  const delta = data.current - data.previous;

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Receipt className="h-4 w-4 text-kpakpato-orange" /> Frais Mobile Money ce mois-ci
          </p>
          <p className="mt-1 text-2xl font-black text-white">{formatFCFA(data.current)}</p>
          <p className="text-[11px] text-slate-400">
            {data.currentCount} frais enregistré{data.currentCount > 1 ? "s" : ""}
          </p>
        </div>
        {data.previous > 0 || data.current > 0 ? (
          <span
            className={`mt-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              delta > 0 ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"
            }`}
          >
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta === 0 ? "Stable" : `${delta > 0 ? "+" : "-"}${formatFCFA(Math.abs(delta))}`} vs mois dernier
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex h-20 items-end gap-2" aria-label="Frais des 6 derniers mois">
        {data.months.map((m, i) => {
          const isCurrent = i === data.months.length - 1;
          return (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-14 w-full items-end">
                <div
                  className={`w-full rounded-t-md ${isCurrent ? "bg-kpakpato-orange" : "bg-slate-600"}`}
                  style={{ height: `${Math.max(m.total > 0 ? 8 : 2, (m.total / data.max) * 100)}%` }}
                  title={`${m.label} : ${formatFCFA(m.total)}`}
                />
              </div>
              <span className={`text-[10px] ${isCurrent ? "font-bold text-white" : "text-slate-500"}`}>{m.label}</span>
            </div>
          );
        })}
      </div>

      {data.perWallet.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {data.perWallet.map((w) => (
            <div key={w.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.color }} />
                {w.name}
              </span>
              <span className="font-bold text-white">{formatFCFA(w.total)}</span>
            </div>
          ))}
        </div>
      )}

      {data.current === 0 && (
        <p className="mt-3 text-[11px] text-slate-500">
          Les frais apparaissent ici quand vous importez un SMS avec des frais, ou quand vous ajoutez une dépense dans la
          catégorie « Frais & Commissions ».
        </p>
      )}
    </div>
  );
}
