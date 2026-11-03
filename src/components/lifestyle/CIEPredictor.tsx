"use client";

import React, { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useLifestyle } from "@/context/LifestyleContext";
import { formatFCFA } from "@/lib/finance-utils";
import { forecastCie } from "@/lib/lifestyle";
import { card, field, ghostBtn } from "./ui";

const LEVEL = {
  unknown: { bar: "bg-slate-500", text: "text-slate-300", label: "" },
  ok: { bar: "bg-emerald-500", text: "text-emerald-300", label: "Tout va bien" },
  soon: { bar: "bg-amber-500", text: "text-amber-300", label: "Pensez à recharger bientôt" },
  urgent: { bar: "bg-rose-500", text: "text-rose-300", label: "Rechargez vite, la coupure approche" },
} as const;

/** Prévoit combien de jours il reste sur le compteur CIE prépayé, d'après le rythme des recharges détectées. */
export default function CIEPredictor() {
  const { transactions } = useFinance();
  const { data, update } = useLifestyle();
  const [reading, setReading] = useState("");

  const forecast = useMemo(() => forecastCie(transactions, data.cie), [transactions, data.cie]);
  const style = LEVEL[forecast.level];
  const pct =
    forecast.remaining !== null && forecast.lastAmount
      ? Math.max(0, Math.min(100, Math.round((forecast.remaining / Math.max(forecast.lastAmount, forecast.remaining)) * 100)))
      : 0;

  return (
    <div className={card}>
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
        <Zap className="h-4 w-4 text-amber-400" /> Compteur CIE prépayé
      </h3>

      {forecast.purchases === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Aucune recharge CIE détectée. Dès qu&apos;un paiement dont le libellé contient « CIE » est importé ou enregistré,
          Kpakpato calcule votre rythme de consommation.
        </p>
      )}

      {forecast.purchases === 1 && (
        <p className="mt-2 text-xs text-slate-400">
          Une recharge détectée ({formatFCFA(forecast.lastAmount ?? 0)}). Après la prochaine, Kpakpato pourra estimer le nombre de
          jours qu&apos;il vous reste.
        </p>
      )}

      {forecast.level !== "unknown" && forecast.daysLeft !== null && (
        <>
          <p className={`mt-2 text-lg font-extrabold ${style.text}`}>
            Il vous reste environ {forecast.daysLeft} jour{forecast.daysLeft > 1 ? "s" : ""} d&apos;électricité
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Environ {formatFCFA(forecast.remaining ?? 0)} restants · vous consommez ≈ {formatFCFA(forecast.ratePerDay ?? 0)} par jour
            {style.label ? ` · ${style.label}` : ""}
          </p>
          {forecast.level !== "ok" && (
            <p className={`mt-2 rounded-lg bg-slate-900/70 p-2 text-xs font-semibold ${style.text}`}>
              ⚠️ Rechargez avant la coupure : une recharge de {formatFCFA(Math.round((forecast.ratePerDay ?? 0) * 15 / 500) * 500 || 5000)} couvre
              environ 15 jours.
            </p>
          )}
        </>
      )}

      {forecast.purchases > 0 && (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(reading);
            if (!Number.isFinite(value) || value < 0 || reading === "") return;
            update((prev) => ({ ...prev, cie: { remaining: Math.round(value), at: new Date().toISOString() } }));
            setReading("");
          }}
        >
          <label className="flex-1 text-[11px] text-slate-400">
            Ce que le compteur affiche maintenant (facultatif, rend la prévision plus précise)
            <input className={`${field} mt-1`} type="number" inputMode="numeric" min={0} placeholder="FCFA" value={reading} onChange={(e) => setReading(e.target.value)} />
          </label>
          <button type="submit" className={ghostBtn}>
            Valider
          </button>
        </form>
      )}
    </div>
  );
}
