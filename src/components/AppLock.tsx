"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Fingerprint, Lock } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { LockSettings } from "@/components/LockSetup";
import {
  clearCloudLock,
  consumeLockReset,
  getLockDelayMs,
  hasBiometric,
  hasLock,
  markLockForReset,
  PIN_LENGTH,
  removeLock,
  syncLock,
  unlockWithBiometric,
  verifyPin,
} from "@/lib/app-lock";

type Phase = "checking" | "setup" | "locked" | "error";

/**
 * Tout utilisateur connecté passe par un code (ou l'empreinte / le visage) pour entrer dans l'app.
 * Le code est créé une seule fois, lié au compte, puis valable sur tous les appareils.
 */
export default function AppLock({ children }: { children: React.ReactNode }) {
  const { user, signOutUser } = useFinance();
  const uid = user?.uid ?? null;
  const [phase, setPhase] = useState<Phase>("checking");
  const [unlockedFor, setUnlockedFor] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastActive = useRef(Date.now());

  useEffect(() => {
    if (!uid) {
      setUnlockedFor(null);
      return;
    }
    let cancelled = false;
    setPhase("checking");
    (async () => {
      // « Code oublié » : la connexion Google qui vient d'avoir lieu prouve l'identité, on repart de zéro.
      if (consumeLockReset(uid)) {
        removeLock(uid);
        await clearCloudLock(uid);
        if (!cancelled) setPhase("setup");
        return;
      }
      const res = await syncLock(uid);
      if (cancelled) return;
      setPhase(res === "ready" ? "locked" : res === "missing" ? "setup" : "error");
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, attempt]);

  useEffect(() => {
    const expire = () => {
      if (Date.now() - lastActive.current > getLockDelayMs()) setUnlockedFor(null);
    };
    const touch = () => {
      expire();
      lastActive.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") expire();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(expire, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, []);

  // Code créé ou changé dans le profil : on reste déverrouillé.
  useEffect(() => {
    const onChanged = () => {
      if (uid && hasLock(uid)) {
        lastActive.current = Date.now();
        setUnlockedFor(uid);
        setPhase("locked");
      }
    };
    window.addEventListener("kpakpato-lock-changed", onChanged);
    return () => window.removeEventListener("kpakpato-lock-changed", onChanged);
  }, [uid]);

  const open = !uid || (phase === "locked" && unlockedFor === uid);

  return (
    <>
      {children}
      {!open && uid && phase === "checking" && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950 text-sm text-slate-400">
          Chargement…
        </div>
      )}
      {!open && uid && phase === "error" && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
          <p className="text-sm text-slate-300">Connexion impossible pour vérifier votre code. Vérifiez votre réseau.</p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-2xl bg-kpakpato-orange px-6 py-3 text-sm font-bold text-white"
          >
            Réessayer
          </button>
        </div>
      )}
      {!open && uid && phase === "setup" && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 overflow-y-auto bg-slate-950 px-6 py-8">
          <div className="w-full max-w-sm">
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-white">
              <Lock className="h-5 w-5 text-kpakpato-orange" />
              Protégez votre application
            </h1>
            <p className="mt-1 mb-4 text-xs text-slate-400">
              Choisissez un code à 6 chiffres. Il vous sera demandé à chaque ouverture, sur tous vos appareils, et vous
              pourrez aussi utiliser votre empreinte ou votre visage.
            </p>
            <LockSettings />
          </div>
        </div>
      )}
      {!open && uid && phase === "locked" && (
        <LockScreen
          uid={uid}
          name={user?.displayName || user?.email || ""}
          onUnlock={() => {
            lastActive.current = Date.now();
            setUnlockedFor(uid);
          }}
          onForgot={async () => {
            markLockForReset(uid);
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
