"use client";

import React, { useMemo, useState } from "react";
import { MessageCircle, Plus, Trash2 } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useLifestyle } from "@/context/LifestyleContext";
import { formatFCFA } from "@/lib/finance-utils";
import { type Debt, type DebtKind, debtProgress, debtReminderMessage, newId, whatsappLink } from "@/lib/lifestyle";
import { displayParty } from "@/lib/smart-categorizer";
import { card, field, ghostBtn, primaryBtn } from "./ui";

/** Qui me doit, à qui je dois : prêts, « bons » de boutique. Se solde tout seul quand le paiement arrive. */
export default function DebtTracker() {
  const { transactions } = useFinance();
  const { data, update } = useLifestyle();
  const [kind, setKind] = useState<DebtKind>("owed_to_me");
  const [person, setPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Transferts sortants récents : un geste suffit pour les marquer comme « prêt à rembourser ».
  const recentTransfers = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense" && t.subtype === "transfert" && t.party)
        .filter((t) => !data.debts.some((d) => d.note === `Transfert du ${new Date(t.date).toLocaleDateString("fr-FR")}` && d.amount === t.amount))
        .slice(0, 5),
    [transactions, data.debts]
  );

  const add = (d: Omit<Debt, "id" | "createdAt">) =>
    update((prev) => ({ ...prev, debts: [{ ...d, id: newId("debt"), createdAt: new Date().toISOString() }, ...prev.debts] }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!person.trim() || !Number.isFinite(value) || value <= 0) return;
    add({ kind, person: person.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}), amount: Math.round(value), ...(note.trim() ? { note: note.trim() } : {}) });
    setPerson("");
    setPhone("");
    setAmount("");
    setNote("");
    setShowForm(false);
  };

  const rows = data.debts.map((d) => ({ d, ...debtProgress(d, transactions) }));
  const open = rows.filter((r) => !r.settled);
  const closed = rows.filter((r) => r.settled);
  const owedToMe = open.filter((r) => r.d.kind === "owed_to_me").reduce((s, r) => s + r.remaining, 0);
  const iOwe = open.filter((r) => r.d.kind === "i_owe").reduce((s, r) => s + r.remaining, 0);

  return (
    <div className="space-y-3">
      <div className={card}>
        <h3 className="text-sm font-extrabold text-white">Dettes, prêts et bons</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-500/10 p-3">
            <p className="text-[11px] text-emerald-300">On me doit</p>
            <p className="text-sm font-extrabold text-emerald-300">{formatFCFA(owedToMe)}</p>
          </div>
          <div className="rounded-xl bg-rose-500/10 p-3">
            <p className="text-[11px] text-rose-300">Je dois</p>
            <p className="text-sm font-extrabold text-rose-300">{formatFCFA(iOwe)}</p>
          </div>
        </div>

        {recentTransfers.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-slate-300">Un de ces transferts est un prêt ?</p>
            <ul className="mt-1.5 space-y-1.5">
              {recentTransfers.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/60 p-2">
                  <span className="min-w-0 truncate text-[11px] text-slate-200">
                    {formatFCFA(t.amount)} → {displayParty(t.party ?? "")}
                  </span>
                  <button
                    className={ghostBtn}
                    onClick={() =>
                      add({
                        kind: "owed_to_me",
                        person: displayParty(t.party ?? ""),
                        phone: /\d{8}/.test((t.party ?? "").replace(/\D/g, "")) ? t.party : undefined,
                        amount: t.amount,
                        note: `Transfert du ${new Date(t.date).toLocaleDateString("fr-FR")}`,
                      })
                    }
                  >
                    Prêt à rembourser
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!showForm ? (
          <button onClick={() => setShowForm(true)} className={`${primaryBtn} mt-3 flex w-full items-center justify-center gap-2`}>
            <Plus className="h-4 w-4" /> Ajouter une dette ou un bon
          </button>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type">
              {(
                [
                  ["owed_to_me", "On me doit"],
                  ["i_owe", "Je dois (bon boutique…)"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`rounded-xl border px-2 py-2 text-[11px] font-bold ${kind === k ? "border-kpakpato-orange bg-kpakpato-orange/15 text-white" : "border-slate-700 text-slate-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input className={field} placeholder={kind === "owed_to_me" ? "Qui vous doit ?" : "À qui devez-vous ? (ex : boutique de Maman Awa)"} value={person} onChange={(e) => setPerson(e.target.value)} />
            <input className={field} inputMode="tel" placeholder="Numéro (pour solder automatiquement et relancer)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className={field} type="number" inputMode="numeric" min={1} placeholder="Montant en FCFA" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className={field} placeholder="Pour quoi ? (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <button type="submit" className={`${primaryBtn} flex-1`}>
                Enregistrer
              </button>
              <button type="button" className={ghostBtn} onClick={() => setShowForm(false)}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>

      {open.map(({ d, paid, remaining }) => (
        <div key={d.id} className={card}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{d.person}</p>
              <p className="text-[11px] text-slate-400">
                {d.kind === "owed_to_me" ? "Vous doit" : "Vous lui devez"} · depuis le {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                {d.note ? ` · ${d.note}` : ""}
              </p>
            </div>
            <p className={`shrink-0 text-sm font-extrabold ${d.kind === "owed_to_me" ? "text-emerald-300" : "text-rose-300"}`}>{formatFCFA(remaining)}</p>
          </div>
          {paid > 0 && <p className="mt-1 text-[11px] text-emerald-400">Déjà {d.kind === "owed_to_me" ? "reçu" : "payé"} : {formatFCFA(paid)} sur {formatFCFA(d.amount)}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={whatsappLink(d.phone, debtReminderMessage(d, remaining))}
              target="_blank"
              rel="noreferrer"
              className={`${ghostBtn} inline-flex items-center gap-1.5`}
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> Rappel WhatsApp courtois
            </a>
            <button className={ghostBtn} onClick={() => update((prev) => ({ ...prev, debts: prev.debts.map((x) => (x.id === d.id ? { ...x, settledAt: new Date().toISOString() } : x)) }))}>
              Marquer comme soldé
            </button>
            <button
              aria-label="Supprimer"
              className={ghostBtn}
              onClick={() => update((prev) => ({ ...prev, debts: prev.debts.filter((x) => x.id !== d.id) }))}
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
            </button>
          </div>
          {!d.phone && <p className="mt-2 text-[10px] text-slate-500">Ajoutez un numéro pour que la dette se solde seule et pour ouvrir le message directement dans le bon contact.</p>}
        </div>
      ))}

      {closed.length > 0 && (
        <details className={card}>
          <summary className="cursor-pointer text-xs font-bold text-slate-300">Soldées ({closed.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {closed.map(({ d }) => (
              <li key={d.id} className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  ✅ {d.person} · {formatFCFA(d.amount)}
                </span>
                <button className="underline" onClick={() => update((prev) => ({ ...prev, debts: prev.debts.filter((x) => x.id !== d.id) }))}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
