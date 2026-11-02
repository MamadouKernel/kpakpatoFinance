"use client";

import React, { useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { GENDER_LABELS } from "@/lib/household-utils";
import type { Gender } from "@/types/finance";

const OPTIONS: Gender[] = ["femme", "homme", "autre"];

/** Affiché une seule fois, à la création du compte, avant d'accéder à l'app. */
export default function GenderOnboarding() {
  const { saveGender } = useHousehold();
  const [gender, setGender] = useState<Gender | null>(null);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = gender !== null && (gender !== "autre" || other.trim().length > 0);

  const submit = async () => {
    if (!gender || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await saveGender(gender, other);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Bienvenue 👋</h1>
        <p className="mt-2 text-sm text-slate-400">
          Une dernière étape pour créer votre compte : vous êtes…
        </p>
      </div>

      <div className="w-full space-y-2" role="radiogroup" aria-label="Genre">
        {OPTIONS.map((g) => (
          <button
            key={g}
            role="radio"
            aria-checked={gender === g}
            onClick={() => setGender(g)}
            className={`w-full rounded-2xl border px-4 py-3.5 text-sm font-bold transition ${
              gender === g
                ? "border-kpakpato-orange bg-kpakpato-orange/15 text-white"
                : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
            }`}
          >
            {GENDER_LABELS[g]}
          </button>
        ))}
      </div>

      {gender === "autre" && (
        <div className="w-full text-left">
          <label className="text-xs font-semibold text-slate-300" htmlFor="gender-other">
            Précisez (obligatoire)
          </label>
          <input
            id="gender-other"
            autoFocus
            value={other}
            onChange={(e) => setOther(e.target.value)}
            maxLength={40}
            placeholder="Ex. non-binaire"
            className="mt-1 w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-slate-600 focus:ring-kpakpato-orange"
          />
        </div>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <button
        onClick={submit}
        disabled={!canSubmit || busy}
        className="w-full rounded-2xl bg-kpakpato-orange py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
      >
        Continuer
      </button>
    </div>
  );
}
