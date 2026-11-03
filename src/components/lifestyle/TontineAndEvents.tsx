"use client";

import React, { useMemo, useState } from "react";
import { CalendarDays, Copy, MessageCircle, Plus, Trash2, Users } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useLifestyle } from "@/context/LifestyleContext";
import { formatFCFA } from "@/lib/finance-utils";
import { eventPresets, monthKey, monthlyNeeded, monthsUntil, newId, tontineMemberStatus, tontineSummary, whatsappLink } from "@/lib/lifestyle";
import { card, field, ghostBtn, primaryBtn } from "./ui";

/** Mode « Trésorier de tontine » : la cotisation du mois se coche toute seule quand le transfert d'un membre arrive. */
export function TontineTreasurer() {
  const { transactions } = useFinance();
  const { data, update } = useLifestyle();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState<Record<string, { name: string; phone: string }>>({});
  const month = monthKey(new Date());

  const patch = (id: string, change: (t: (typeof data.tontines)[number]) => (typeof data.tontines)[number]) =>
    update((prev) => ({ ...prev, tontines: prev.tontines.map((t) => (t.id === id ? change(t) : t)) }));

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // copie refusée : le texte reste lisible dans le message WhatsApp
    }
  };

  return (
    <div className="space-y-3">
      <div className={card}>
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Users className="h-4 w-4 text-kpakpato-orange" /> Trésorier de tontine
        </h3>
        <p className="mt-1 text-xs text-slate-400">Ajoutez vos membres avec leur numéro : leur cotisation du mois est cochée « Payée » dès que leur transfert arrive.</p>
        <form
          className="mt-3 grid grid-cols-[1fr_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(amount);
            if (!name.trim() || !Number.isFinite(value) || value <= 0) return;
            update((prev) => ({ ...prev, tontines: [...prev.tontines, { id: newId("tontine"), name: name.trim(), amount: Math.round(value), members: [], paid: {} }] }));
            setName("");
            setAmount("");
          }}
        >
          <input className={field} placeholder="Nom de la tontine" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={`${field} w-28`} type="number" inputMode="numeric" min={1} placeholder="FCFA/mois" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button type="submit" className={`${primaryBtn} col-span-2 flex items-center justify-center gap-2`}>
            <Plus className="h-4 w-4" /> Créer la tontine
          </button>
        </form>
      </div>

      {data.tontines.map((t) => {
        const draft = memberDraft[t.id] ?? { name: "", phone: "" };
        const summary = tontineSummary(t, month, transactions);
        const paidCount = t.members.filter((m) => tontineMemberStatus(t, m, month, transactions).paid).length;
        return (
          <div key={t.id} className={card}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-white">{t.name}</p>
                <p className="text-[11px] text-slate-400">
                  {formatFCFA(t.amount)} par membre · {paidCount}/{t.members.length} payé{paidCount > 1 ? "s" : ""} ce mois
                </p>
              </div>
              <button aria-label="Supprimer la tontine" className={ghostBtn} onClick={() => update((prev) => ({ ...prev, tontines: prev.tontines.filter((x) => x.id !== t.id) }))}>
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              </button>
            </div>

            <ul className="mt-3 space-y-1.5">
              {t.members.map((m) => {
                const st = tontineMemberStatus(t, m, month, transactions);
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/60 p-2">
                    <label className="flex min-w-0 items-center gap-2 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={st.paid}
                        disabled={st.auto}
                        onChange={(e) =>
                          patch(t.id, (x) => {
                            const ids = new Set(x.paid[month] ?? []);
                            if (e.target.checked) ids.add(m.id);
                            else ids.delete(m.id);
                            return { ...x, paid: { ...x.paid, [month]: Array.from(ids) } };
                          })
                        }
                      />
                      <span className="truncate">
                        {m.name}
                        {m.phone ? <span className="text-slate-500"> · {m.phone}</span> : null}
                      </span>
                    </label>
                    <span className={`shrink-0 text-[11px] font-bold ${st.paid ? "text-emerald-300" : "text-amber-300"}`}>
                      {st.paid ? (st.auto ? "Payée ✅ (reçue)" : "Payée ✅") : "En attente ⏳"}
                    </span>
                    <button aria-label={`Retirer ${m.name}`} className="text-slate-500" onClick={() => patch(t.id, (x) => ({ ...x, members: x.members.filter((y) => y.id !== m.id) }))}>
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>

            <form
              className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.name.trim()) return;
                patch(t.id, (x) => ({ ...x, members: [...x.members, { id: newId("m"), name: draft.name.trim(), phone: draft.phone.trim() }] }));
                setMemberDraft((prev) => ({ ...prev, [t.id]: { name: "", phone: "" } }));
              }}
            >
              <input className={field} placeholder="Nom du membre" value={draft.name} onChange={(e) => setMemberDraft((p) => ({ ...p, [t.id]: { ...draft, name: e.target.value } }))} />
              <input className={field} inputMode="tel" placeholder="Numéro" value={draft.phone} onChange={(e) => setMemberDraft((p) => ({ ...p, [t.id]: { ...draft, phone: e.target.value } }))} />
              <button type="submit" className={ghostBtn} aria-label="Ajouter le membre">
                <Plus className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              <button className={`${ghostBtn} inline-flex items-center gap-1.5`} onClick={() => copy(t.id, summary)}>
                <Copy className="h-3.5 w-3.5" /> {copied === t.id ? "Copié ✔" : "Copier le résumé"}
              </button>
              <a className={`${ghostBtn} inline-flex items-center gap-1.5`} href={whatsappLink(undefined, summary)} target="_blank" rel="noreferrer">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> Envoyer sur WhatsApp
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Rentrée, Tabaski, Korité, Noël : l'épargne à mettre de côté chaque mois pour arriver prêt à la date. */
export function EventsPlanner() {
  const { data, update } = useLifestyle();
  const presets = useMemo(() => eventPresets(), []);
  const [name, setName] = useState(presets[0].name);
  const [date, setDate] = useState(presets[0].date);
  const [target, setTarget] = useState("");

  return (
    <div className="space-y-3">
      <div className={card}>
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
          <CalendarDays className="h-4 w-4 text-kpakpato-orange" /> Fêtes et rentrée
        </h3>
        <p className="mt-1 text-xs text-slate-400">Choisissez l&apos;événement et ce que vous voulez y dépenser : Kpakpato calcule l&apos;épargne mensuelle.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => {
                setName(p.name);
                setDate(p.date);
              }}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${name === p.name ? "bg-kpakpato-orange text-white" : "bg-slate-900 text-slate-300 ring-1 ring-slate-600"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <form
          className="mt-3 grid grid-cols-2 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = Number(target);
            if (!name.trim() || !date || !Number.isFinite(value) || value <= 0) return;
            update((prev) => ({ ...prev, events: [...prev.events, { id: newId("evt"), name: name.trim(), date, target: Math.round(value), saved: 0 }] }));
            setTarget("");
          }}
        >
          <input className={field} placeholder="Événement" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={field} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={`${field} col-span-2`} type="number" inputMode="numeric" min={1} placeholder="Budget visé en FCFA" value={target} onChange={(e) => setTarget(e.target.value)} />
          <button type="submit" className={`${primaryBtn} col-span-2 flex items-center justify-center gap-2`}>
            <Plus className="h-4 w-4" /> Planifier
          </button>
        </form>
        <p className="mt-2 text-[10px] text-slate-500">Les dates de Tabaski et de Korité sont indicatives : elles dépendent de la lune. Corrigez-les à l&apos;annonce officielle.</p>
      </div>

      {data.events
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => {
          const need = monthlyNeeded(e);
          const pct = e.target > 0 ? Math.min(100, Math.round((e.saved / e.target) * 100)) : 0;
          return (
            <div key={e.id} className={card}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{e.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · dans {monthsUntil(e.date)} mois
                  </p>
                </div>
                <button aria-label="Supprimer" className={ghostBtn} onClick={() => update((prev) => ({ ...prev, events: prev.events.filter((x) => x.id !== e.id) }))}>
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                </button>
              </div>
              <p className="mt-2 text-lg font-extrabold text-emerald-300">{formatFCFA(need)} à mettre de côté chaque mois</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-kpakpato-green" style={{ width: `${pct}%` }} />
              </div>
              <label className="mt-2 block text-[11px] text-slate-400">
                Déjà mis de côté
                <input
                  className={`${field} mt-1`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={e.saved === 0 ? "" : e.saved}
                  placeholder="0"
                  onChange={(ev) => {
                    const n = Number(ev.target.value);
                    update((prev) => ({ ...prev, events: prev.events.map((x) => (x.id === e.id ? { ...x, saved: Number.isFinite(n) && n >= 0 ? Math.round(n) : 0 } : x)) }));
                  }}
                />
                <span className="mt-1 block">Objectif {formatFCFA(e.target)} · {pct} % atteint</span>
              </label>
            </div>
          );
        })}
    </div>
  );
}
