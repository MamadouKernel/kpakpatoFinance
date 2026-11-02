"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardPaste, Share2, Smartphone, X } from "lucide-react";
import { setPendingImport } from "@/lib/import-inbox";

const step = "flex items-start gap-3";
const num =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-kpakpato-orange text-xs font-extrabold text-white";

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-3 space-y-2.5">
      {items.map((text, i) => (
        <li key={i} className={step}>
          <span className={num}>{i + 1}</span>
          <span className="pt-0.5 text-xs leading-snug text-slate-200">{text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Explique comment faire arriver les transactions du téléphone dans Kpakpato. */
export default function PhoneConnect({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIsAndroid(/android/i.test(navigator.userAgent));
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setOrigin(window.location.origin);
  }, []);

  const pasteAndImport = async () => {
    setPasteError(null);
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        setPasteError("Le presse-papiers est vide : copiez d'abord le SMS ou la notification.");
        return;
      }
      setPendingImport(text);
      onClose();
      onImport();
    } catch {
      setPasteError("Autorisez l'accès au presse-papiers, ou collez le texte dans « Importer SMS ».");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Importer depuis mon téléphone"
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-white">
            <Smartphone className="h-5 w-5 text-kpakpato-orange" />
            Importer depuis mon téléphone
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" title="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Ajoutez vos transactions Wave, Orange Money, MTN et Moov en un geste, sans les ressaisir et sans rien télécharger.
        </p>

        {/* iPhone : automatisation Raccourcis d'Apple */}
        {isIOS && (
          <section className="mt-3 rounded-2xl border border-kpakpato-green/50 bg-kpakpato-green/5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Smartphone className="h-4 w-4 text-kpakpato-green" />
              iPhone · Automatisation avec Raccourcis
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Apple interdit à une app de lire vos messages, mais son app Raccourcis peut ouvrir Kpakpato à chaque SMS
              de Wave ou Orange Money. À configurer une seule fois (iOS 17 ou plus récent conseillé).
            </p>
            <Steps
              items={[
                "Ouvrez l'app Raccourcis → onglet Automatisation → « + » → Message.",
                "Dans « Le message contient », saisissez Wave (créez-en une autre pour Orange Money). Choisissez « Exécuter immédiatement » puis Suivant.",
                "Choisissez « Nouveau raccourci vierge » et ajoutez l'action « URL », avec ce texte :",
              ]}
            />
            <code className="mt-2 block break-all rounded-lg bg-slate-800 p-2 text-[11px] text-kpakpato-orange">
              {origin}/?text=
            </code>
            <Steps
              items={[
                "Juste après « ?text= », touchez la zone et insérez la variable « Contenu du message » (variable magique « Message »).",
                "Ajoutez l'action « Ouvrir les URL » et validez.",
              ]}
            />
            <p className="mt-2 text-[11px] text-slate-500">
              À chaque SMS Wave, Kpakpato s'ouvre et importe la transaction. Elle s'ouvre dans Safari : connectez-vous une
              fois avec Google, vos données sont les mêmes que dans l&apos;app installée. Réglage non vérifié sur tous les
              modèles : si une étape diffère chez vous, utilisez « Coller et importer ».
            </p>
          </section>
        )}

        {/* Mode 1 : partage depuis la PWA */}
        <section className="mt-5 rounded-2xl border border-slate-700/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Share2 className="h-4 w-4 text-kpakpato-green" />
            Partager le message
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">Un geste par transaction. Android uniquement.</p>
          <Steps
            items={[
              installed
                ? "Kpakpato est déjà installée sur votre écran d'accueil ✔"
                : "Installez Kpakpato sur votre écran d'accueil (bouton « Installer » en haut de l'app).",
              "Ouvrez le SMS ou la notification de la transaction, appuyez longuement sur le texte et choisissez Partager.",
              "Choisissez « Kpakpato » : la transaction s'ouvre dans l'écran d'import.",
              "Vous pouvez aussi copier le texte : en revenant sur l'app, elle propose l'import (option dans « Importer SMS »).",
            ]}
          />
          {!isAndroid && (
            <p className="mt-3 text-[11px] text-amber-400">
              Le partage vers une PWA n'est disponible que sur Android. Sur iPhone, copiez le texte puis collez-le dans « Importer SMS ».
            </p>
          )}
        </section>

        {/* Mode 2 : copier puis coller */}
        <section className="mt-3 rounded-2xl border border-slate-700/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <ClipboardPaste className="h-4 w-4 text-kpakpato-orange" />
            Copier puis importer (Android et iPhone)
          </h3>
          <Steps
            items={[
              "Copiez le texte du SMS ou de la notification de la transaction.",
              "Revenez ici et appuyez sur « Coller et importer ».",
              "Pour que l'app le propose d'elle-même à chaque retour, cochez l'option dans « Importer SMS » (l'import automatique y est aussi proposé).",
            ]}
          />
          <button
            onClick={pasteAndImport}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-kpakpato-orange py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            <ClipboardPaste className="h-4 w-4" />
            Coller et importer
          </button>
          {pasteError && <p className="mt-2 text-[11px] text-amber-400">{pasteError}</p>}
          <p className="mt-3 text-[11px] text-slate-500">
            Le texte n&apos;est lu que sur votre appareil, et seulement quand vous le demandez ou l&apos;avez autorisé.
          </p>
        </section>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700"
        >
          Fermer
        </button>
      </div>
    </div>,
    document.body
  );
}
