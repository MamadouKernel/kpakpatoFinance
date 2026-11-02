"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ClipboardPaste, Download, Share2, Smartphone, X } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { useFinance } from "@/context/FinanceContext";
import { db } from "@/lib/firebase";
import { setPendingImport } from "@/lib/import-inbox";
import { isNativeApp, nativeStatus } from "@/lib/native-bridge";

/** Fichier à déposer dans public/ après avoir construit l'app Android (voir android-app/README.md). */
const APK_PATH = "/kpakpato.apk";

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

function formatLast(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Explique comment faire arriver les transactions du téléphone dans Kpakpato, et indique si c'est branché. */
export default function PhoneConnect({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const { user } = useFinance();
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [native, setNative] = useState(false);
  const [perm, setPerm] = useState<{ notifications: boolean; sms: boolean } | null>(null);
  const [apkReady, setApkReady] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIsAndroid(/android/i.test(navigator.userAgent));
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setOrigin(window.location.origin);
    const inApp = isNativeApp();
    setNative(inApp);
    if (inApp) {
      const refresh = () => setPerm(nativeStatus());
      refresh();
      window.addEventListener("focus", refresh);
      return () => window.removeEventListener("focus", refresh);
    }
    fetch(APK_PATH, { method: "HEAD" })
      .then((r) => setApkReady(r.ok && !(r.headers.get("content-type") ?? "").includes("text/html")))
      .catch(() => setApkReady(false));
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

  const uid = user?.uid;
  useEffect(() => {
    if (!db || !uid) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const v = snap.data()?.companionLastAt;
        setLastAt(typeof v === "string" ? v : null);
      },
      () => undefined
    );
  }, [uid]);

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
          Ajoutez vos transactions Wave, Orange Money, MTN et Moov en un geste, sans les ressaisir et sans rien télécharger de plus.
        </p>

        {lastAt && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            Dernier message reçu du téléphone le {formatLast(lastAt)}
          </div>
        )}

        {/* Capture automatique : app Android Kpakpato */}
        <section className="mt-5 rounded-2xl border border-kpakpato-orange/50 bg-kpakpato-orange/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Smartphone className="h-4 w-4 text-kpakpato-orange" />
            Capture automatique · app Android Kpakpato
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Vos notifications et SMS de transaction arrivent tout seuls, sans rien copier ni importer.
          </p>

          {native ? (
            <div className="mt-3 space-y-2 text-xs">
              {(
                [
                  { ok: perm?.notifications, label: "Lecture des notifications", act: () => window.KpakpatoNative?.openNotificationSettings() },
                  { ok: perm?.sms, label: "Lecture des SMS", act: () => window.KpakpatoNative?.requestSmsPermission() },
                ] as const
              ).map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-xl bg-slate-800 p-2.5">
                  <span className={row.ok ? "text-emerald-300" : "text-slate-300"}>
                    {row.ok ? "✔" : "✘"} {row.label}
                  </span>
                  {!row.ok && (
                    <button onClick={row.act} className="rounded-lg bg-kpakpato-orange px-3 py-1 text-[11px] font-bold text-white">
                      Autoriser
                    </button>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-slate-500">
                Sur Tecno, Infinix ou Xiaomi : excluez Kpakpato de l&apos;économiseur de batterie, sinon Android peut arrêter la capture.
              </p>
            </div>
          ) : (
            <>
              {isAndroid && apkReady ? (
                <a
                  href={APK_PATH}
                  download
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-kpakpato-orange py-2.5 text-sm font-bold text-white hover:opacity-90"
                >
                  <Download className="h-4 w-4" />
                  Télécharger l&apos;app Android
                </a>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-800 p-3 text-[11px] text-slate-300">
                  {!isAndroid
                    ? "Disponible sur Android uniquement (Apple interdit la lecture des notifications d'autres apps)."
                    : apkReady === null
                      ? "Vérification…"
                      : "L'app Android n'est pas encore publiée sur cette plateforme."}
                </p>
              )}
              <Steps
                items={[
                  "Téléchargez l'app et ouvrez le fichier (autorisez l'installation depuis cette source si Android le demande).",
                  "Ouvrez Kpakpato Finance : c'est la même application, avec le même compte Google.",
                  "Ouvrez cette fenêtre dans l'app et appuyez sur « Autoriser » pour les notifications et les SMS.",
                ]}
              />
              <p className="mt-2 text-[11px] text-slate-500">Elle remplace la PWA : vous retrouvez les mêmes données.</p>
            </>
          )}
        </section>

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
            Sans l'app · Partager le message
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
            Sans l'app · Copier puis importer (Android et iPhone)
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
