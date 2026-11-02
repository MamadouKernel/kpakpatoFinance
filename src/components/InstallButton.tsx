"use client";

import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// L'évènement n'est émis qu'une fois : on le garde hors du composant pour ne pas
// le perdre quand l'écran de connexion laisse place à l'app.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallButton({ compact = false }: { compact?: boolean }) {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setCanPrompt(Boolean(deferredPrompt));
    setReady(true);

    const sync = () => {
      setCanPrompt(Boolean(deferredPrompt));
      if (!deferredPrompt && isStandalone()) setInstalled(true);
    };
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  if (!ready || installed) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      const evt = deferredPrompt;
      deferredPrompt = null;
      setCanPrompt(false);
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      return;
    }
    setShowHelp(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:border-kpakpato-orange transition"
            : "inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-bold text-slate-200 transition hover:border-kpakpato-orange"
        }
      >
        <Download className={compact ? "h-3.5 w-3.5 text-kpakpato-orange" : "h-4 w-4 text-kpakpato-orange"} />
        {compact ? "Installer" : "Installer l'app"}
      </button>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white">Installer Kpakpato Finance</h2>
              <button
                onClick={() => setShowHelp(false)}
                aria-label="Fermer"
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {isIOS ? (
              <ol className="list-decimal space-y-2 pl-5 text-xs text-slate-300">
                <li>Ouvrez cette page dans <b>Safari</b> (pas Chrome).</li>
                <li>Appuyez sur le bouton <b>Partager</b> (carré avec une flèche vers le haut).</li>
                <li>Faites défiler et choisissez <b>Sur l&apos;écran d&apos;accueil</b>.</li>
                <li>Appuyez sur <b>Ajouter</b>.</li>
              </ol>
            ) : (
              <ol className="list-decimal space-y-2 pl-5 text-xs text-slate-300">
                <li>Ouvrez cette page dans <b>Chrome</b> (hors navigation privée).</li>
                <li>Appuyez sur le menu <b>⋮</b> en haut à droite.</li>
                <li>Choisissez <b>Installer l&apos;application</b> ou <b>Ajouter à l&apos;écran d&apos;accueil</b>.</li>
              </ol>
            )}
            {!isIOS && !canPrompt && (
              <p className="mt-3 text-[11px] text-slate-500">
                Si l&apos;option n&apos;apparaît pas, l&apos;app est peut-être déjà installée sur cet appareil.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
