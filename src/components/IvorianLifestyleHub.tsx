"use client";

import React, { useState } from "react";
import CIEPredictor from "@/components/lifestyle/CIEPredictor";
import DebtTracker from "@/components/lifestyle/DebtTracker";
import TransportTracker from "@/components/lifestyle/TransportTracker";
import ZeroFee from "@/components/lifestyle/ZeroFee";
import QuickExpense from "@/components/lifestyle/QuickExpense";
import { EventsPlanner, TontineTreasurer } from "@/components/lifestyle/TontineAndEvents";

type Section = "express" | "zerofee" | "cie" | "debts" | "tontine" | "events" | "transport";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "express", label: "🎙️ Dépense express" },
  { id: "zerofee", label: "💸 Zéro frais" },
  { id: "transport", label: "🚕 Transport" },
  { id: "cie", label: "⚡ CIE" },
  { id: "debts", label: "🤝 Dettes" },
  { id: "tontine", label: "👥 Tontine" },
  { id: "events", label: "🎉 Fêtes" },
];

/** La vie quotidienne en Côte d'Ivoire : dépenses en espèces, compteur CIE, dettes, tontine et grandes dates. */
export default function IvorianLifestyleHub() {
  const [section, setSection] = useState<Section>("express");
  return (
    <section className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar" role="tablist" aria-label="Vie quotidienne">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
              section === s.id ? "bg-kpakpato-orange text-white" : "bg-slate-800 text-slate-300 ring-1 ring-slate-700"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "express" && <QuickExpense />}
      {section === "zerofee" && <ZeroFee />}
      {section === "transport" && <TransportTracker />}
      {section === "cie" && <CIEPredictor />}
      {section === "debts" && <DebtTracker />}
      {section === "tontine" && <TontineTreasurer />}
      {section === "events" && <EventsPlanner />}
    </section>
  );
}
