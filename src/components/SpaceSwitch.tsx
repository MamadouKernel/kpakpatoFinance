"use client";

import React from "react";
import { useHousehold } from "@/context/HouseholdContext";

export default function SpaceSwitch() {
  const { space, setSpace } = useHousehold();
  const base = "flex-1 rounded-xl px-3 py-2 text-xs font-bold transition";
  const on = "bg-kpakpato-orange text-white shadow";
  const off = "text-slate-400 hover:text-slate-200";
  return (
    <div
      role="tablist"
      aria-label="Espace"
      className="mx-4 mt-3 flex gap-1 rounded-2xl border border-slate-800 bg-slate-900 p-1"
    >
      <button
        role="tab"
        aria-selected={space === "personal"}
        onClick={() => setSpace("personal")}
        className={`${base} ${space === "personal" ? on : off}`}
      >
        Mon Espace
      </button>
      <button
        role="tab"
        aria-selected={space === "couple"}
        onClick={() => setSpace("couple")}
        className={`${base} ${space === "couple" ? on : off}`}
      >
        Espace Couple 👩‍❤️‍👨
      </button>
    </div>
  );
}
