"use client";

import React, { useMemo, useState } from "react";
import { Copy, LogOut, Users } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useHousehold } from "@/context/HouseholdContext";
import {
  filterTransactionsByPeriod,
  formatFCFA,
  isInternalTransfer,
  parseFcfaInput,
} from "@/lib/finance-utils";
import { isFirebaseConfigured } from "@/lib/firebase";
import type { WalletInfo } from "@/types/finance";

const card = "rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4";
const input =
  "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-600 focus:ring-kpakpato-orange";
const primaryBtn =
  "w-full rounded-xl bg-kpakpato-orange py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-40";

function monthFlows(transactions: Parameters<typeof filterTransactionsByPeriod>[0]) {
  const month = filterTransactionsByPeriod(transactions, "month");
  let income = 0;
  let expense = 0;
  let internal = 0;
  for (const t of month) {
    if (isInternalTransfer(t)) {
      if (t.type === "expense") internal += t.amount;
      continue;
    }
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, internal };
}

function sumWallets(wallets: WalletInfo[]) {
  return wallets.reduce((a, w) => a + w.balance, 0);
}

export default function CoupleSpace() {
  const { user, wallets, transactions } = useFinance();
  const {
    household,
    partner,
    partnerUid,
    partnerData,
    loading,
    createHousehold,
    joinHousehold,
    leaveHousehold,
    updateMyProfile,
    setMonthlyBudget,
  } = useHousehold();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [alias, setAlias] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mine = useMemo(() => monthFlows(transactions), [transactions]);
  const theirs = useMemo(
    () => (partnerData ? monthFlows(partnerData.transactions) : { income: 0, expense: 0, internal: 0 }),
    [partnerData]
  );

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (success) setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  if (!isFirebaseConfigured || !user) {
    return (
      <div className={card}>
        <p className="text-sm text-slate-300">Connectez-vous avec Google pour utiliser l&apos;Espace Couple.</p>
      </div>
    );
  }

  if (loading && !household) {
    return <div className={`${card} text-sm text-slate-400`}>Chargement du foyer…</div>;
  }

  // ── Pas encore de foyer : créer ou rejoindre ───────────────────────────────
  if (!household) {
    return (
      <div className="space-y-4">
        <div className={card}>
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Users className="h-4 w-4 text-kpakpato-orange" /> Créer un foyer
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Vous obtenez un code à donner à votre conjoint(e) pour lier vos deux comptes.
          </p>
          <div className="mt-3 space-y-2">
            <input className={input} placeholder="Nom du foyer (ex. Famille Konaté)" value={name} onChange={(e) => setName(e.target.value)} />
            <input className={input} inputMode="tel" placeholder="Votre numéro Mobile Money (ex. 07 07 07 07 07)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className={input} placeholder="Votre nom dans les SMS (optionnel)" value={alias} onChange={(e) => setAlias(e.target.value)} />
            <button className={primaryBtn} disabled={busy} onClick={() => run(() => createHousehold(name, { phone, alias }))}>
              Créer le foyer
            </button>
          </div>
        </div>

        <div className={card}>
          <h2 className="text-sm font-extrabold text-white">Rejoindre avec un code</h2>
          <div className="mt-3 space-y-2">
            <input className={`${input} uppercase tracking-widest`} placeholder="CODE D'INVITATION" value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} />
            <input className={input} inputMode="tel" placeholder="Votre numéro Mobile Money" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className={input} placeholder="Votre nom dans les SMS (optionnel)" value={alias} onChange={(e) => setAlias(e.target.value)} />
            <button className={primaryBtn} disabled={busy || code.trim().length < 6} onClick={() => run(() => joinHousehold(code, { phone, alias }))}>
              Rejoindre le foyer
            </button>
          </div>
        </div>

        {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
      </div>
    );
  }

  // ── Foyer actif ────────────────────────────────────────────────────────────
  const myName = household.members[user.uid]?.name || "Moi";
  const partnerName = partner?.name || "Conjoint(e)";
  const myTotal = sumWallets(wallets);
  const partnerTotal = partnerData ? sumWallets(partnerData.wallets) : 0;
  const total = myTotal + partnerTotal;

  const spent = mine.expense + theirs.expense;
  const earned = mine.income + theirs.income;
  const budget = household.monthlyBudget;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  const byWallet = wallets.map((w) => {
    const other = partnerData?.wallets.find((p) => p.id === w.id)?.balance ?? 0;
    return { id: w.id, name: w.shortName, color: w.color, total: w.balance + other };
  });

  const profile = household.members[user.uid] ?? { name: myName };

  const recent = (partnerData?.transactions ?? []).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-kpakpato-orange/30 via-slate-800 to-kpakpato-green/20 p-5 ring-1 ring-slate-700/60">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">
          {household.name} · solde consolidé
        </p>
        <p className="mt-1 text-3xl font-black text-white">{formatFCFA(total)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl bg-slate-900/60 p-3">
            <p className="text-slate-400">{myName}</p>
            <p className="font-bold text-white">{formatFCFA(myTotal)}</p>
          </div>
          <div className="rounded-xl bg-slate-900/60 p-3">
            <p className="text-slate-400">{partner ? partnerName : "En attente…"}</p>
            <p className="font-bold text-white">{partner ? formatFCFA(partnerTotal) : "—"}</p>
          </div>
        </div>
      </div>

      {!partnerUid && (
        <div className={card}>
          <p className="text-sm font-bold text-white">Invitez votre conjoint(e)</p>
          <p className="mt-1 text-xs text-slate-400">Donnez-lui ce code : il/elle le saisit dans « Rejoindre avec un code ».</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-center text-lg font-black tracking-[0.3em] text-kpakpato-orange">
              {household.inviteCode}
            </code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(household.inviteCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  // presse-papiers indisponible
                }
              }}
              className="rounded-lg bg-slate-700 p-2.5 text-white"
              title="Copier"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          {copied && <p className="mt-1 text-xs text-emerald-400">Code copié.</p>}
        </div>
      )}

      {partnerUid && !partnerData && (
        <p className="text-xs text-amber-400">
          {partnerName} n&apos;a pas encore partagé ses soldes : ils apparaîtront dès qu&apos;il/elle ouvrira l&apos;app.
        </p>
      )}

      <div className={card}>
        <h3 className="text-sm font-extrabold text-white">Par portefeuille (à deux)</h3>
        <div className="mt-3 space-y-2">
          {byWallet.map((w) => (
            <div key={w.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.color }} />
                {w.name}
              </span>
              <span className="font-bold text-white">{formatFCFA(w.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-extrabold text-white">Budget du mois (partagé)</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-slate-400">Dépenses à deux</p>
            <p className="font-bold text-rose-400">-{formatFCFA(spent)}</p>
          </div>
          <div>
            <p className="text-slate-400">Revenus à deux</p>
            <p className="font-bold text-emerald-400">+{formatFCFA(earned)}</p>
          </div>
        </div>
        {budget > 0 ? (
          <div className="mt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-400" : "bg-kpakpato-green"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-300">
              {formatFCFA(spent)} sur {formatFCFA(budget)} ({pct}%) ·{" "}
              {spent <= budget ? `reste ${formatFCFA(budget - spent)}` : `dépassé de ${formatFCFA(spent - budget)}`}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-400">Aucun budget défini.</p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            className={input}
            inputMode="numeric"
            placeholder={budget > 0 ? `Budget actuel : ${budget}` : "Budget mensuel en FCFA"}
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
          />
          <button
            className="shrink-0 rounded-lg bg-kpakpato-green px-4 text-sm font-bold text-white disabled:opacity-40"
            disabled={busy || parseFcfaInput(budgetInput) === null}
            onClick={() =>
              run(async () => {
                const n = parseFcfaInput(budgetInput);
                if (n !== null) await setMonthlyBudget(n);
                setBudgetInput("");
              }, "Budget enregistré.")
            }
          >
            OK
          </button>
        </div>
        {mine.internal + theirs.internal > 0 && (
          <p className="mt-3 text-[11px] text-slate-400">
            Virements entre vous ce mois : {formatFCFA(mine.internal + theirs.internal)} (non comptés comme dépenses).
          </p>
        )}
      </div>

      {partnerData && recent.length > 0 && (
        <div className={card}>
          <h3 className="text-sm font-extrabold text-white">Dernières opérations de {partnerName}</h3>
          <div className="mt-3 space-y-2">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-100">{t.title}</p>
                  <p className="text-slate-500">
                    {t.category} · {new Date(t.date).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <span className={`shrink-0 font-bold ${t.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.type === "income" ? "+" : "-"}
                  {formatFCFA(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={card}>
        <h3 className="text-sm font-extrabold text-white">Mon profil dans le foyer</h3>
        <p className="mt-1 text-xs text-slate-400">
          Votre numéro et votre nom permettent à votre conjoint(e) de classer automatiquement ses virements vers vous
          en « Virement interne au foyer ».
        </p>
        <div className="mt-3 space-y-2">
          <input
            className={input}
            inputMode="tel"
            placeholder="Mon numéro Mobile Money"
            defaultValue={profile.phone ?? ""}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className={input}
            placeholder="Mon nom dans les SMS (ex. KONATE AMINATA)"
            defaultValue={profile.alias ?? ""}
            onChange={(e) => setAlias(e.target.value)}
          />
          <button
            className={primaryBtn}
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  updateMyProfile({
                    phone: phone || profile.phone || "",
                    alias: alias || profile.alias || "",
                  }),
                "Profil enregistré."
              )
            }
          >
            Enregistrer
          </button>
        </div>
        {partner && (
          <p className="mt-3 text-[11px] text-slate-500">
            Détecté pour {partnerName} : {partner.phone ? `n° ${partner.phone}` : "pas de numéro"}
            {partner.alias ? ` · nom « ${partner.alias} »` : ""}
          </p>
        )}
      </div>

      {notice && <p className="text-xs font-semibold text-emerald-400">{notice}</p>}
      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <button
        onClick={() => {
          if (window.confirm("Quitter ce foyer ? Vous ne verrez plus les soldes de votre conjoint(e).")) {
            run(leaveHousehold);
          }
        }}
        className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-rose-400"
      >
        <LogOut className="h-3.5 w-3.5" /> Quitter le foyer
      </button>
    </div>
  );
}
