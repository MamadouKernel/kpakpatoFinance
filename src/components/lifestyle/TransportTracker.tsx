"use client";

import React, { useMemo, useState } from "react";
import { Bus } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatFCFA } from "@/lib/finance-utils";
import { analyzeTransport, TRANSPORT_KIND_LABELS } from "@/lib/transport-analysis";
import { card, ghostBtn } from "./ui";

/** Où part l'argent du transport (Yango, gbaka, péage HKB, carburant) et ce qu'on économiserait en changeant de mode. */
export default function TransportTracker() {
  const { transactions } = useFinance();
  const [period, setPeriod] = useState<"month" | "week">("month");
  const report = useMemo(() => analyzeTransport(transactions, period), [transactions, period]);
  const vtc = report.byKind.find((k) => k.kind === "vtc");

  return (
    <div className={card}>
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
        <Bus className="h-4 w-4 text-kpakpato-orange" /> Transport à Abidjan
      </h3>
      <div className="mt-2 flex gap-2">
        {(
          [
            ["month", "Ce mois"],
            ["week", "7 jours"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} onClick={() => setPeriod(id)} className={`${ghostBtn} ${period === id ? "!bg-kpakpato-orange !text-white" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {report.count === 0 ? (
        <p className="mt-3 text-xs text-slate-400">
          Aucun transport enregistré sur cette période. Les courses Yango, gbaka, woro-woro, péages et carburant sont reconnus dans vos
          dépenses et dans la dépense express.
        </p>
      ) : (
        <>
          <p className="mt-3 text-lg font-extrabold text-white">{formatFCFA(report.total)}</p>
          <p className="text-[11px] text-slate-400">{report.count} dépense{report.count > 1 ? "s" : ""} de transport</p>
          <ul className="mt-3 space-y-2">
            {report.byKind.map((k) => (
              <li key={k.kind}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200">{TRANSPORT_KIND_LABELS[k.kind]}</span>
                  <span className="font-bold text-white">{formatFCFA(k.amount)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div className="h-full rounded-full bg-kpakpato-orange" style={{ width: `${Math.round((k.amount / report.total) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>

          {vtc && vtc.amount > 0 && (
            <div className="mt-4 rounded-xl bg-emerald-500/10 p-3">
              <p className="text-xs font-bold text-emerald-300">Et si une partie de vos courses VTC passait en gbaka ou woro-woro ?</p>
              <ul className="mt-2 space-y-1">
                {report.savings.map((s) => (
                  <li key={s.sharePct} className="flex justify-between text-xs text-slate-200">
                    <span>{s.sharePct} % des courses</span>
                    <span className="font-bold text-emerald-300">≈ {formatFCFA(s.amount)} économisés</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-slate-500">
                Hypothèse : un trajet en transport commun coûte environ le tiers d&apos;une course VTC. Ordre de grandeur, pas une promesse.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
