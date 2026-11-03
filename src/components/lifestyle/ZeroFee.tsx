"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatFCFA } from "@/lib/finance-utils";
import { compareFees, DEFAULT_FEE_RATES, FEE_ACTION_LABELS, type FeeAction, rateFor } from "@/lib/zero-fee";
import { card, field, ghostBtn } from "./ui";

const STORAGE_KEY = "kpakpato_fee_rates_v1";

/** Avant un envoi, un paiement ou un retrait : quel portefeuille coûte le moins de frais, selon vos soldes. */
export default function ZeroFee() {
  const { wallets } = useFinance();
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<FeeAction>("envoi");
  const [rates, setRates] = useState<Record<string, Record<FeeAction, number>>>(DEFAULT_FEE_RATES);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (saved && typeof saved === "object") setRates({ ...DEFAULT_FEE_RATES, ...saved });
    } catch {
      // taux par défaut
    }
  }, []);

  const setRate = (walletId: string, a: FeeAction, value: number) => {
    const next = { ...rates, [walletId]: { ...(rates[walletId] ?? DEFAULT_FEE_RATES[walletId] ?? { envoi: 1, paiement: 0, retrait: 1 }), [a]: value } };
    setRates(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignoré
    }
  };

  const value = Number(amount);
  const options = useMemo(() => (Number.isFinite(value) && value > 0 ? compareFees(wallets, value, action, rates) : []), [wallets, value, action, rates]);
  const best = options.find((o) => o.affordable);

  return (
    <div className={card}>
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
        <Coins className="h-4 w-4 text-kpakpato-orange" /> Comparateur « zéro frais »
      </h3>
      <p className="mt-1 text-xs text-slate-400">Entrez le montant : Kpakpato vous dit quel portefeuille utiliser pour payer le moins de frais.</p>

      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Opération">
        {(Object.keys(FEE_ACTION_LABELS) as FeeAction[]).map((a) => (
          <button
            key={a}
            role="radio"
            aria-checked={action === a}
            onClick={() => setAction(a)}
            className={`rounded-xl border px-1 py-2 text-[11px] font-bold ${action === a ? "border-kpakpato-orange bg-kpakpato-orange/15 text-white" : "border-slate-700 text-slate-300"}`}
          >
            {FEE_ACTION_LABELS[a]}
          </button>
        ))}
      </div>
      <input className={`${field} mt-2`} type="number" inputMode="numeric" min={1} placeholder="Montant en FCFA" value={amount} onChange={(e) => setAmount(e.target.value)} />

      {options.length > 0 && (
        <>
          {best ? (
            <p className={`mt-3 rounded-xl p-3 text-xs font-bold ${best.fee === 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-900/70 text-white"}`}>
              Utilisez {best.wallet.shortName} : {best.fee === 0 ? "0 FCFA de frais 🎉" : `${formatFCFA(best.fee)} de frais`}
            </p>
          ) : (
            <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs font-bold text-amber-300">
              Aucun portefeuille n&apos;a assez de solde pour ce montant et ses frais. Rechargez-en un ou divisez le paiement.
            </p>
          )}
          <ul className="mt-2 space-y-1.5">
            {options.map((o) => (
              <li key={o.wallet.id} className={`flex items-center justify-between rounded-xl bg-slate-900/60 p-2 text-xs ${o.affordable ? "" : "opacity-50"}`}>
                <span className="text-slate-200">
                  {o.wallet.shortName} <span className="text-slate-500">({formatFCFA(o.wallet.balance)})</span>
                </span>
                <span className={`font-bold ${o.fee === 0 ? "text-emerald-300" : "text-white"}`}>
                  {o.affordable ? (o.fee === 0 ? "0 FCFA" : formatFCFA(o.fee)) : "solde insuffisant"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className={`${ghostBtn} mt-3`} onClick={() => setEditing((v) => !v)}>
        {editing ? "Masquer les taux" : "Vérifier ou corriger les taux de frais"}
      </button>
      {editing && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-slate-500">Taux indicatifs en % du montant : les opérateurs changent leurs barèmes, corrigez-les d&apos;après vos propres frais.</p>
          {wallets
            .filter((w) => w.id !== "cash")
            .map((w) => (
              <div key={w.id} className="grid grid-cols-[1fr_repeat(3,64px)] items-center gap-2 text-[11px] text-slate-300">
                <span className="truncate">{w.shortName}</span>
                {(Object.keys(FEE_ACTION_LABELS) as FeeAction[]).map((a) => (
                  <input
                    key={a}
                    aria-label={`${w.shortName} ${FEE_ACTION_LABELS[a]}`}
                    className={`${field} px-2 py-1 text-center`}
                    type="number"
                    step="0.1"
                    min={0}
                    value={rateFor(rates, w.id, a)}
                    onChange={(e) => setRate(w.id, a, Math.max(0, Number(e.target.value) || 0))}
                  />
                ))}
              </div>
            ))}
          <p className="text-[10px] text-slate-500">Colonnes : envoyer · payer un marchand · retirer.</p>
        </div>
      )}
    </div>
  );
}
