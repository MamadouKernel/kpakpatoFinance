"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, HeartHandshake, Plus, Trash2, Users } from "lucide-react";
import { useCommunity } from "@/context/CommunityContext";
import { useFinance } from "@/context/FinanceContext";
import { filterTransactionsByPeriod, formatFCFA, parseFcfaInput } from "@/lib/finance-utils";
import type { Tontine, TontineFrequency, WalletId } from "@/types/finance";

const card = "rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4";
const input =
  "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-600 focus:ring-kpakpato-orange";
const FAMILY_CATEGORY = "Famille & Tontine";
const WEEKS_PER_MONTH = 52 / 12;

/** Début du cycle en cours : lundi de la semaine, ou 1er du mois. */
function cycleStart(frequency: TontineFrequency): Date {
  const now = new Date();
  if (frequency === "monthly") return new Date(now.getFullYear(), now.getMonth(), 1);
  const day = (now.getDay() + 6) % 7; // lundi = 0
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
}

const daysUntil = (iso: string) => {
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

export default function TontineSection() {
  const { wallets, transactions, addTransaction } = useFinance();
  const { tontines, solidarityBudget, addTontine, removeTontine, setSolidarityBudget } = useCommunity();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [contribution, setContribution] = useState("");
  const [frequency, setFrequency] = useState<TontineFrequency>("monthly");
  const [members, setMembers] = useState("10");
  const [walletId, setWalletId] = useState<WalletId>("wave");
  const [payoutDate, setPayoutDate] = useState("");

  const [budgetInput, setBudgetInput] = useState("");
  const [showAid, setShowAid] = useState(false);
  const [aidTitle, setAidTitle] = useState("");
  const [aidAmount, setAidAmount] = useState("");
  const [aidWallet, setAidWallet] = useState<WalletId>("wave");

  const paidIds = useMemo(() => {
    const paid = new Set<string>();
    for (const t of tontines) {
      const start = cycleStart(t.frequency);
      if (transactions.some((x) => x.tontineId === t.id && new Date(x.date) >= start)) paid.add(t.id);
    }
    return paid;
  }, [tontines, transactions]);

  const monthlyCommitment = tontines.reduce(
    (sum, t) => sum + (t.frequency === "weekly" ? t.contribution * WEEKS_PER_MONTH : t.contribution),
    0
  );

  const solidaritySpent = useMemo(
    () =>
      filterTransactionsByPeriod(transactions, "month")
        .filter((t) => t.type === "expense" && t.category === FAMILY_CATEGORY && !t.tontineId)
        .reduce((a, t) => a + t.amount, 0),
    [transactions]
  );
  const pct = solidarityBudget > 0 ? Math.min(100, Math.round((solidaritySpent / solidarityBudget) * 100)) : 0;

  const walletName = (id: WalletId) => wallets.find((w) => w.id === id)?.shortName ?? id;

  const contribute = (t: Tontine) =>
    addTransaction({
      title: `Tontine ${t.name}`,
      amount: t.contribution,
      type: "expense",
      category: FAMILY_CATEGORY,
      walletId: t.walletId,
      tontineId: t.id,
      note: t.frequency === "weekly" ? "Cotisation hebdomadaire" : "Cotisation mensuelle",
    });

  const submitTontine = () => {
    const amount = parseFcfaInput(contribution);
    const count = Number(members);
    if (!name.trim() || amount === null || amount <= 0 || !Number.isFinite(count) || count < 2) return;
    addTontine({
      name: name.trim(),
      contribution: amount,
      frequency,
      members: Math.round(count),
      walletId,
      ...(payoutDate ? { payoutDate: new Date(`${payoutDate}T12:00:00`).toISOString() } : {}),
    });
    setName("");
    setContribution("");
    setMembers("10");
    setPayoutDate("");
    setShowForm(false);
  };

  const submitAid = () => {
    const amount = parseFcfaInput(aidAmount);
    if (!aidTitle.trim() || amount === null || amount <= 0) return;
    addTransaction({
      title: `Aide famille : ${aidTitle.trim()}`,
      amount,
      type: "expense",
      category: FAMILY_CATEGORY,
      walletId: aidWallet,
    });
    setAidTitle("");
    setAidAmount("");
    setShowAid(false);
  };

  return (
    <section className="space-y-3">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
        Tontine & Solidarité familiale
      </h2>

      {/* Tontines */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Users className="h-4 w-4 text-kpakpato-orange" /> Mes tontines
          </p>
          {tontines.length > 0 && (
            <span className="text-[11px] text-slate-400">≈ {formatFCFA(Math.round(monthlyCommitment))} / mois</span>
          )}
        </div>

        {tontines.length === 0 && !showForm && (
          <p className="mt-2 text-xs text-slate-400">
            Ajoutez vos tontines pour suivre vos cotisations et savoir quand vous recevez la cagnotte.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {tontines.map((t) => {
            const paid = paidIds.has(t.id);
            const pot = t.contribution * t.members;
            const days = t.payoutDate ? daysUntil(t.payoutDate) : null;
            return (
              <div key={t.id} className="rounded-xl bg-slate-900/70 p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{t.name}</p>
                    <p className="text-slate-400">
                      {formatFCFA(t.contribution)} / {t.frequency === "weekly" ? "semaine" : "mois"} · {t.members} membres
                      · {walletName(t.walletId)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer la tontine « ${t.name} » ? Vos cotisations déjà enregistrées restent dans l'historique.`))
                        removeTontine(t.id);
                    }}
                    aria-label="Supprimer la tontine"
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="mt-2 text-slate-300">
                  Cagnotte d&apos;un tour : <b className="text-white">{formatFCFA(pot)}</b>
                  {days !== null &&
                    (days >= 0
                      ? ` · vous la recevez dans ${days} jour${days > 1 ? "s" : ""} (${new Date(t.payoutDate!).toLocaleDateString("fr-FR")})`
                      : ` · tour passé le ${new Date(t.payoutDate!).toLocaleDateString("fr-FR")}`)}
                </p>

                {paid ? (
                  <p className="mt-2 flex items-center gap-1.5 font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Cotisation {t.frequency === "weekly" ? "de la semaine" : "du mois"} payée
                  </p>
                ) : (
                  <button
                    onClick={() => contribute(t)}
                    className="mt-2 w-full rounded-lg bg-kpakpato-orange py-2 text-xs font-bold text-white transition hover:brightness-110 active:scale-95"
                  >
                    Cotiser {formatFCFA(t.contribution)} maintenant
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {showForm ? (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-700 p-3">
            <input className={input} placeholder="Nom (ex. Tontine du bureau)" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={input} inputMode="numeric" placeholder="Cotisation (FCFA)" value={contribution} onChange={(e) => setContribution(e.target.value)} />
              <select className={input} value={frequency} onChange={(e) => setFrequency(e.target.value as TontineFrequency)}>
                <option value="monthly">Chaque mois</option>
                <option value="weekly">Chaque semaine</option>
              </select>
              <input className={input} type="number" min={2} inputMode="numeric" placeholder="Participants" value={members} onChange={(e) => setMembers(e.target.value)} />
              <select className={input} value={walletId} onChange={(e) => setWalletId(e.target.value as WalletId)}>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    Payer avec {w.shortName}
                  </option>
                ))}
              </select>
            </div>
            <label className="block text-[11px] text-slate-400">
              Date où je reçois la cagnotte (facultatif)
              <input className={`${input} mt-1`} type="date" value={payoutDate} onChange={(e) => setPayoutDate(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button onClick={submitTontine} className="flex-1 rounded-lg bg-kpakpato-green py-2 text-sm font-bold text-white">
                Ajouter
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-lg bg-slate-700 px-4 text-sm font-bold text-slate-200">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-600 py-2 text-xs font-bold text-slate-300 hover:border-kpakpato-orange"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter une tontine
          </button>
        )}
      </div>

      {/* Solidarité familiale */}
      <div className={card}>
        <p className="flex items-center gap-2 text-sm font-extrabold text-white">
          <HeartHandshake className="h-4 w-4 text-kpakpato-orange" /> Solidarité familiale
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Fixez une enveloppe mensuelle pour l&apos;aide à la famille (« taxe familiale ») afin qu&apos;elle ne grignote
          pas tout votre salaire.
        </p>

        {solidarityBudget > 0 && (
          <div className="mt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-kpakpato-green"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-300">
              {formatFCFA(solidaritySpent)} donnés sur {formatFCFA(solidarityBudget)} ({pct} %) ·{" "}
              {solidaritySpent <= solidarityBudget
                ? `il reste ${formatFCFA(solidarityBudget - solidaritySpent)}`
                : `dépassé de ${formatFCFA(solidaritySpent - solidarityBudget)}`}
            </p>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            className={input}
            inputMode="numeric"
            placeholder={solidarityBudget > 0 ? `Enveloppe actuelle : ${solidarityBudget}` : "Enveloppe mensuelle (FCFA)"}
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
          />
          <button
            disabled={parseFcfaInput(budgetInput) === null}
            onClick={() => {
              const n = parseFcfaInput(budgetInput);
              if (n !== null) setSolidarityBudget(n);
              setBudgetInput("");
            }}
            className="shrink-0 rounded-lg bg-kpakpato-green px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            OK
          </button>
        </div>

        {showAid ? (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-700 p-3">
            <input className={input} placeholder="Pour qui ? (ex. Maman, scolarité…)" value={aidTitle} onChange={(e) => setAidTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className={input} inputMode="numeric" placeholder="Montant (FCFA)" value={aidAmount} onChange={(e) => setAidAmount(e.target.value)} />
              <select className={input} value={aidWallet} onChange={(e) => setAidWallet(e.target.value as WalletId)}>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    Depuis {w.shortName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={submitAid} className="flex-1 rounded-lg bg-kpakpato-orange py-2 text-sm font-bold text-white">
                Enregistrer l&apos;aide
              </button>
              <button onClick={() => setShowAid(false)} className="rounded-lg bg-slate-700 px-4 text-sm font-bold text-slate-200">
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAid(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-600 py-2 text-xs font-bold text-slate-300 hover:border-kpakpato-orange"
          >
            <Plus className="h-3.5 w-3.5" /> Enregistrer une aide à la famille
          </button>
        )}
      </div>
    </section>
  );
}
