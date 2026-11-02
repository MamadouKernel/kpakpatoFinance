"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Fingerprint, Lock } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { hasBiometric, hasLock, PIN_LENGTH, removeLock, unlockWithBiometric, verifyPin } from "@/lib/app-lock";

/** Délai passé en arrière-plan au-delà duquel l'app se reverrouille. */
const RELOCK_AFTER_MS = 30_000;

/** Écran de verrouillage (code, empreinte ou visage) affiché par-dessus l'app tant qu'elle n'est pas déverrouillée. */
export default function AppLock({ children }: { children: React.ReactNode }) {
  const { user, signOutUser } = useFinance();
  const uid = user?.uid ?? null;
  const [unlockedFor, setUnlockedFor] = useState<string | null>(null);
  const [, bump] = useState(0);
  const hiddenAt = useRef<number | null>(null);

  const locked = Boolean(uid && unlockedFor !== uid && hasLock(uid));

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        hiddenAt.current = null;
        setUnlockedFor(null);
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  // Un code créé ou supprimé dans le profil doit être pris en compte tout de suite.
  useEffect(() => {
    const refresh = () => bump((n) => n + 1);
    window.addEventListener("kpakpato-lock-changed", refresh);
    return () => window.removeEventListener("kpakpato-lock-changed", refresh);
  }, []);

  return (
    <>
      {children}
      {locked && uid && (
        <LockScreen
          uid={uid}
          name={user?.displayName || user?.email || ""}
          onUnlock={() => setUnlockedFor(uid)}
          onForgot={async () => {
            removeLock(uid);
            await signOutUser();
          }}
        />
      )}
    </>
  );
}

function LockScreen({
  uid,
  name,
  onUnlock,
  onForgot,
}: {
  uid: string;
  name: string;
  onUnlock: () => void;
  onForgot: () => void;
}) {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bio = hasBiometric(uid);
  const tried = useRef(false);

  const tryBiometric = useCallback(async () => {
    setMessage(null);
    if (await unlockWithBiometric(uid)) onUnlock();
    else setMessage("Empreinte ou visage non reconnu : entrez votre code.");
  }, [uid, onUnlock]);

  useEffect(() => {
    if (bio && !tried.current) {
      tried.current = true;
      void tryBiometric();
    }
  }, [bio, tryBiometric]);

  const submit = async (value: string) => {
    setBusy(true);
    const res = await verifyPin(uid, value);
    setBusy(false);
    if (res === "ok") {
      onUnlock();
      return;
    }
    setPin("");
    setMessage(
      res === "wrong" ? "Code incorrect." : `Trop d'essais. Réessayez dans ${res.wait} secondes.`
    );
  };

  const press = (digit: string) => {
    if (busy || pin.length >= PIN_LENGTH.max) return;
    setMessage(null);
    const next = pin + digit;
    setPin(next);
    if (next.length === PIN_LENGTH.max) void submit(next);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-5 bg-slate-950 px-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-label="Application verrouillée"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-kpakpato-orange to-kpakpato-green text-white shadow-md">
        <Lock className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-xl font-extrabold text-white">
          Kpakpato <span className="text-kpakpato-orange">Finance</span>
        </h1>
        <p className="mt-1 text-xs text-slate-400">{name}</p>
      </div>

      <div className="flex h-4 gap-2" aria-label={`${pin.length} chiffres saisis`}>
        {Array.from({ length: Math.max(PIN_LENGTH.min, pin.length) }).map((_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full ${i < pin.length ? "bg-kpakpato-orange" : "bg-slate-700"}`} />
        ))}
      </div>
      <p className="h-4 text-xs font-semibold text-rose-400">{message}</p>

      <div className="grid w-60 grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="rounded-2xl bg-slate-900 py-3.5 text-xl font-bold text-white ring-1 ring-slate-700 active:scale-95"
          >
            {d}
          </button>
        ))}
        {bio ? (
          <button
            onClick={tryBiometric}
            aria-label="Utiliser l'empreinte ou le visage"
            className="flex items-center justify-center rounded-2xl text-kpakpato-orange active:scale-95"
          >
            <Fingerprint className="h-7 w-7" />
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={() => press("0")}
          className="rounded-2xl bg-slate-900 py-3.5 text-xl font-bold text-white ring-1 ring-slate-700 active:scale-95"
        >
          0
        </button>
        <button
          onClick={() => {
            setMessage(null);
            setPin(pin.slice(0, -1));
          }}
          aria-label="Effacer"
          className="flex items-center justify-center rounded-2xl text-slate-300 active:scale-95"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>

      <button onClick={onForgot} className="text-[11px] text-slate-500 underline">
        Code oublié ? Se reconnecter avec Google
      </button>
    </div>
  );
}
