"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Prévient quand une version plus récente est en ligne.
 * `autoReload` : recharge seul (utile sur l'écran de connexion, où rien n'est en cours de saisie).
 */
export default function UpdateBanner({ autoReload = false }: { autoReload?: boolean }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (CURRENT === "dev") return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (!cancelled && version && version !== "dev" && version !== CURRENT) {
          setUpdateAvailable(true);
        }
      } catch {
        // Hors ligne : on réessaiera plus tard.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (updateAvailable && autoReload) window.location.reload();
  }, [updateAvailable, autoReload]);

  if (!updateAvailable || autoReload) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex justify-center p-3">
      <div className="flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl border border-kpakpato-orange/50 bg-slate-900 px-4 py-3 shadow-xl">
        <p className="text-xs font-semibold text-slate-100">Une nouvelle version est disponible.</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-kpakpato-orange px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
      </div>
    </div>
  );
}
