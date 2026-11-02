"use client";

import React, { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import {
  biometricSupported,
  disableBiometric,
  getLockDelayMs,
  LOCK_DELAYS,
  setLockDelayMinutes,
  enableBiometric,
  hasBiometric,
  hasLock,
  isValidPin,
  PIN_LENGTH,
  setPin,
} from "@/lib/app-lock";

const field =
  "w-full rounded-lg bg-slate-900 px-3 py-2.5 text-center text-lg tracking-[0.4em] text-white outline-none ring-1 ring-slate-600 focus:ring-kpakpato-orange";

const notify = () => window.dispatchEvent(new Event("kpakpato-lock-changed"));

/** Définir, changer ou retirer le code, et activer l'empreinte ou le visage. */
export function LockSettings({ onDone }: { onDone?: () => void }) {
  const { user } = useFinance();
  const uid = user?.uid ?? "";
  const [, bump] = useState(0);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [again, setAgain] = useState("");
  const [bioOk, setBioOk] = useState(false);
  const [wantBio, setWantBio] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void biometricSupported().then(setBioOk);
  }, []);

  const [delay, setDelay] = useState(25);
  useEffect(() => {
    setDelay(getLockDelayMs() / 60_000);
  }, []);

  const locked = hasLock(uid);
  const bio = hasBiometric(uid);
  const refresh = () => {
    bump((n) => n + 1);
    notify();
  };

  const save = async () => {
    setMessage(null);
    if (!isValidPin(code)) return setMessage(`Le code doit faire ${PIN_LENGTH.max} chiffres.`);
    if (code !== again) return setMessage("Les deux codes ne sont pas identiques.");
    setBusy(true);
    try {
      await setPin(uid, code);
      if (bioOk && wantBio && !hasBiometric(uid)) {
        await enableBiometric(uid, user?.email || user?.displayName || "").catch(() =>
          setMessage("Code enregistré. L'empreinte ou le visage n'a pas pu être activé.")
        );
      }
      setCode("");
      setAgain("");
      setEditing(false);
      refresh();
      onDone?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const toggleBio = async () => {
    setMessage(null);
    if (bio) {
      disableBiometric(uid);
      return refresh();
    }
    try {
      await enableBiometric(uid, user?.email || user?.displayName || "");
      refresh();
    } catch {
      setMessage("Activation impossible ou annulée.");
    }
  };

  if (!uid) return null;

  return (
    <div className="space-y-3">
      {locked && !editing ? (
        <>
          <p className="text-xs text-emerald-400">✔ Verrouillage activé{bio ? " · empreinte / visage" : ""}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(true)} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white">
              Changer le code
            </button>
            {bioOk && (
              <button onClick={toggleBio} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white">
                {bio ? "Désactiver empreinte / visage" : "Activer empreinte / visage"}
              </button>
            )}
          </div>
          <label className="flex items-center justify-between gap-3 text-xs text-slate-300">
            Reverrouiller après
            <select
              value={delay}
              onChange={(e) => {
                const m = Number(e.target.value);
                setDelay(m);
                setLockDelayMinutes(m);
              }}
              className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-slate-600"
            >
              {LOCK_DELAYS.map((m) => (
                <option key={m} value={m}>
                  {m} min d&apos;inactivité
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <>
          <input
            className={field}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH.max}
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <input
            className={field}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH.max}
            placeholder="Confirmer"
            value={again}
            onChange={(e) => setAgain(e.target.value.replace(/\D/g, ""))}
          />
          {bioOk && !bio && (
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={wantBio} onChange={(e) => setWantBio(e.target.checked)} />
              <Fingerprint className="h-4 w-4 text-kpakpato-orange" />
              Déverrouiller aussi avec l&apos;empreinte ou le visage
            </label>
          )}
          <button
            onClick={save}
            disabled={busy}
            className="w-full rounded-2xl bg-kpakpato-orange py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} className="w-full text-xs text-slate-400 underline">
              Annuler
            </button>
          )}
        </>
      )}
      {message && <p className="text-xs font-semibold text-amber-400">{message}</p>}
      <p className="text-[11px] text-slate-500">
        Le code est lié à votre compte : il est valable sur tous vos appareils. L&apos;empreinte ou le visage se règle sur chaque appareil. Le délai de reverrouillage se règle sur chaque appareil.
      </p>
    </div>
  );
}
