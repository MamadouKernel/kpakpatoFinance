"use client";

import React, { useMemo, useState } from "react";
import { Copy, History, LogOut, Share2, Users } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useHousehold } from "@/context/HouseholdContext";
import {
  filterTransactionsByPeriod,
  formatFCFA,
  isInternalTransfer,
  parseFcfaInput,
} from "@/lib/finance-utils";
import { isFirebaseConfigured } from "@/lib/firebase";
import { describeGender, partnerWord } from "@/lib/household-utils";
import type { PastHousehold, WalletInfo } from "@/types/finance";

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
    pastHouseholds,
    endedNotice,
    dismissEndedNotice,
  } = useHousehold();

  const [mode, setMode] = useState<"generate" | "join" | null>(null);
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

  // ── Pas (ou plus) de foyer : générer un code ou saisir celui de l'autre ────
  if (!household) {
    return (
      <div className="space-y-4">
        {endedNotice && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-xs font-semibold text-amber-200">{endedNotice}</p>
            <button onClick={dismissEndedNotice} className="text-xs font-bold text-amber-300">
              OK
            </button>
          </div>
        )}

        <div className={card}>
          <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
            <Users className="h-4 w-4 text-kpakpato-orange" /> Lier mon compte à celui de mon / ma partenaire
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            L&apos;un(e) de vous génère un code et le donne à l&apos;autre, qui le saisit. Peu importe qui commence.
            Une personne ne peut être que dans un seul foyer à la fois.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <button
              onClick={() => {
                setMode("generate");
                setError(null);
              }}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                mode === "generate"
                  ? "border-kpakpato-orange bg-kpakpato-orange/15 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
              }`}
            >
              Je génère un code pour mon / ma partenaire
            </button>
            <button
              onClick={() => {
                setMode("join");
                setError(null);
              }}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                mode === "join"
                  ? "border-kpakpato-orange bg-kpakpato-orange/15 text-white"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
              }`}
            >
              J&apos;ai reçu le code de mon / ma partenaire
            </button>
          </div>

          {mode === "generate" && (
            <div className="mt-4 space-y-2">
              <input
                className={input}
                placeholder="Nom du foyer (facultatif, ex. Famille Konaté)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className={primaryBtn} disabled={busy} onClick={() => run(() => createHousehold(name, {}))}>
                Générer le code
              </button>
              <p className="text-[11px] text-slate-500">
                Le code s&apos;affichera ensuite : donnez-le à votre partenaire.
              </p>
            </div>
          )}

          {mode === "join" && (
            <div className="mt-4 space-y-2">
              <input
                className={`${input} uppercase tracking-widest`}
                placeholder="CODE REÇU"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={12}
                autoFocus
              />
              <button
                className={primaryBtn}
                disabled={busy || code.trim().length < 6}
                onClick={() => run(() => joinHousehold(code, {}))}
              >
                Enregistrer le code
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

        <PastHouseholds items={pastHouseholds} />
      </div>
    );
  }

  // ── Foyer actif ────────────────────────────────────────────────────────────
  const myName = household.members[user.uid]?.name || "Moi";
  const word = partnerWord(partner?.gender);
  const partnerName = partner?.name || word;
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
          <p className="text-sm font-bold text-white">Donnez ce code à votre partenaire</p>
          <p className="mt-1 text-xs text-slate-400">
            Il/elle ouvre l&apos;Espace Couple, puis « J&apos;ai reçu un code », et le saisit. Le code ne sert qu&apos;à vous lier tous les deux.
          </p>
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
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                onClick={() =>
                  navigator
                    .share({ text: `Rejoins mon foyer sur Kpakpato Finance avec ce code : ${household.inviteCode}` })
                    .catch(() => undefined)
                }
                className="rounded-lg bg-slate-700 p-2.5 text-white"
                title="Partager"
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
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
        <h3 className="text-sm font-extrabold text-white">Reconnaître nos virements (facultatif)</h3>
        <p className="mt-1 text-xs text-slate-400">
          Quand vous vous envoyez de l&apos;argent via Wave ou Orange Money, ce n&apos;est pas une vraie dépense. Pour que
          l&apos;app le reconnaisse toute seule à l&apos;import d&apos;un SMS, renseignez comment on vous retrouve :
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-400">
          <li>
            <b className="text-slate-200">Mon numéro</b> : le numéro Wave / Orange Money sur lequel votre partenaire vous
            envoie de l&apos;argent (ex. 07 07 07 07 07).
          </li>
          <li>
            <b className="text-slate-200">Mon nom dans les SMS</b> : votre nom tel qu&apos;il apparaît dans les messages
            (ex. KONATE AMINATA).
          </li>
        </ul>
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
            {partnerName}{partner.gender ? ` (${describeGender(partner.gender, partner.genderOther).toLowerCase()})` : ""} :{" "}
            {partner.phone ? `n° ${partner.phone}` : "pas de numéro"}
            {partner.alias ? ` · nom « ${partner.alias} »` : ""}
          </p>
        )}
      </div>

      {notice && <p className="text-xs font-semibold text-emerald-400">{notice}</p>}
      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <PastHouseholds items={pastHouseholds} />

      <div className={`${card} border-rose-500/30`}>
        <h3 className="text-sm font-extrabold text-white">Dissocier le foyer</h3>
        <p className="mt-1 text-xs text-slate-400">
          Le foyer prend fin pour vous deux : vous ne verrez plus les soldes ni les dépenses de votre {word}, et
          lui/elle ne verra plus les vôtres. Vos propres données restent intactes et une trace de ce foyer est
          conservée dans votre historique. Vous pourrez ensuite créer un nouveau foyer.
        </p>
        <button
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                `Dissocier « ${household.name} » ? Plus aucun de vous deux ne verra les données de l'autre. Cette action est définitive.`
              )
            ) {
              run(leaveHousehold);
            }
          }}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/50 py-2.5 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-40"
        >
          <LogOut className="h-3.5 w-3.5" /> Dissocier ce foyer
        </button>
      </div>
    </div>
  );
}

function PastHouseholds({ items }: { items: PastHousehold[] }) {
  if (items.length === 0) return null;
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "—");
  return (
    <div className={card}>
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
        <History className="h-4 w-4 text-slate-400" /> Anciens foyers
      </h3>
      <div className="mt-3 space-y-2">
        {[...items]
          .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
          .map((h) => (
            <div key={h.id} className="rounded-xl bg-slate-900/70 p-3 text-xs">
              <p className="font-bold text-slate-100">{h.name}</p>
              <p className="text-slate-400">
                {h.partnerName ? `Avec ${h.partnerName} · ` : ""}
                du {fmt(h.startedAt)} au {fmt(h.endedAt)} ·{" "}
                {h.endedByMe
                  ? "dissocié par vous"
                  : `dissocié par ${h.endedByName || "l'autre membre"}${
                      h.endedByGender
                        ? ` (${describeGender(h.endedByGender, h.endedByGenderOther).toLowerCase()})`
                        : ""
                    }`}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
