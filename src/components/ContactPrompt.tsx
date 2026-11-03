"use client";

import React, { useMemo } from "react";
import { X } from "lucide-react";
import { useContacts } from "@/context/ContactsContext";
import { useFinance } from "@/context/FinanceContext";
import { categoryForContact, CONTACT_CHOICES, type ContactCategory, displayParty, partyKey } from "@/lib/smart-categorizer";

/**
 * Bannière non bloquante : la première fois qu'un numéro ou un marchand apparaît sans catégorie,
 * une seule réponse suffit. Elle est mémorisée et classe aussi les anciennes opérations vers ce numéro.
 */
export default function ContactPrompt() {
  const { transactions, recategorizeTransactions } = useFinance();
  const { lookup, remember, dismissed, dismiss } = useContacts();

  const pending = useMemo(() => {
    for (const t of transactions) {
      if (!t.party || t.type !== "expense" || t.category !== "Autre") continue;
      const key = partyKey(t.party);
      if (!key || dismissed.has(key) || lookup(t.party)) continue;
      return t.party;
    }
    return null;
  }, [transactions, lookup, dismissed]);

  if (!pending) return null;
  const key = partyKey(pending);

  const choose = async (category: ContactCategory, label: string) => {
    await remember(pending, { category, label, at: new Date().toISOString() });
    // Les opérations déjà enregistrées vers ce numéro, restées sans catégorie, sont classées aussi.
    const ids = transactions
      .filter((t) => t.category === "Autre" && t.type === "expense" && partyKey(t.party) === key)
      .map((t) => t.id);
    recategorizeTransactions(ids, categoryForContact(category));
  };

  return (
    <div className="rounded-2xl border border-kpakpato-orange/40 bg-kpakpato-orange/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-white">À quoi correspond « {displayParty(pending)} » ?</p>
        <button onClick={() => dismiss(pending)} aria-label="Plus tard" title="Plus tard" className="text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {CONTACT_CHOICES.map((c) => (
          <button
            key={c.label}
            onClick={() => choose(c.category, c.label)}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-100 ring-1 ring-slate-600 hover:ring-kpakpato-orange"
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Une seule réponse : les prochaines opérations seront classées automatiquement.</p>
    </div>
  );
}
