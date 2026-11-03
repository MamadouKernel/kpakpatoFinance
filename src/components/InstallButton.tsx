"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download } from "lucide-react";
import "@/lib/native-bridge";

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

  // Déjà dans l'app Android Kpakpato : rien à installer.
  if (!ready || installed || window.KpakpatoNative) return null;

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

      {showHelp &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5"
            onClick={() => setShowHelp(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Installer Kpakpato Finance"
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-kpakpato-orange to-kpakpato-green text-xl font-black text-white">
                KF
              </div>
              <h2 className="text-lg font-extrabold text-white">Installer Kpakpato Finance</h2>
              <p className="mt-1 text-sm text-slate-400">
                {isIOS ? "Sur iPhone, suivez ces étapes :" : "Sur Android, suivez ces étapes :"}
              </p>

              <ol className="mt-5 space-y-3 text-left">
                {(isIOS
                  ? [
                      "Ouvrez cette page dans Safari (pas Chrome).",
                      "Appuyez sur le bouton Partager (carré avec une flèche vers le haut).",
                      "Choisissez « Sur l'écran d'accueil ».",
                      "Appuyez sur « Ajouter ».",
                    ]
                  : [
                      "Ouvrez cette page dans Chrome (hors navigation privée).",
                      "Appuyez sur le menu ⋮ en haut à droite.",
                      "Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
                    ]
                ).map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-kpakpato-orange text-sm font-extrabold text-white">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-sm leading-snug text-slate-100">{step}</span>
                  </li>
                ))}
              </ol>

              {!isIOS && !canPrompt && (
                <p className="mt-4 text-xs text-slate-500">
                  Si l&apos;option n&apos;apparaît pas, l&apos;app est peut-être déjà installée sur cet appareil.
                </p>
              )}

              <button
                onClick={() => setShowHelp(false)}
                className="mt-6 w-full rounded-2xl bg-kpakpato-orange py-3 text-sm font-bold text-white transition hover:opacity-90"
              >
                J&apos;ai compris
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
