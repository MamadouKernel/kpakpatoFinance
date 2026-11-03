"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardPaste, Copy, Download, Share2, Smartphone, X } from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
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

/** Explique comment faire arriver les transactions du téléphone dans Kpakpato. */
export default function PhoneConnect({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const { user } = useFinance();
  const uid = user?.uid;
  const [native, setNative] = useState(false);
  const [perm, setPerm] = useState<{ notifications: boolean; sms: boolean } | null>(null);
  const [apkReady, setApkReady] = useState<boolean | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
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

  useEffect(() => {
    if (!db || !uid) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const v = snap.data()?.webhookSecret;
        setSecret(typeof v === "string" ? v : null);
      },
      () => undefined
    );
  }, [uid]);

  const generateSecret = async () => {
    if (!db || !uid) return;
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const value = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await setDoc(doc(db, "users", uid), { webhookSecret: value }, { merge: true }).catch(() => undefined);
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // copie refusée : l'utilisateur peut sélectionner le texte
    }
  };

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

        {/* Capture automatique : app Android Kpakpato */}
        {(native || isAndroid) && (
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
                {apkReady ? (
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
                    {apkReady === null ? "Vérification…" : "L'app Android n'est pas encore publiée sur cette plateforme."}
                  </p>
                )}
                <Steps
                  items={[
                    "Téléchargez l'app et ouvrez le fichier (autorisez l'installation depuis cette source si Android le demande).",
                    "Ouvrez Kpakpato Finance : c'est la même application, avec le même compte Google.",
                    "Ouvrez cette fenêtre dans l'app et appuyez sur « Autoriser » pour les notifications et les SMS.",
                  ]}
                />
                <p className="mt-2 text-[11px] text-slate-500">Facultatif : elle remplace la PWA avec les mêmes données.</p>
              </>
            )}
          </section>
        )}

        {!native && (
          <>
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

        {/* Mode 3 : automatisation Android (MacroDroid, Tasker…) */}
        {(
          <section className="mt-3 rounded-2xl border border-slate-700/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Smartphone className="h-4 w-4 text-kpakpato-green" />
              {isIOS ? "Automatique · SMS avec Raccourcis (iPhone)" : "Automatique · MacroDroid / Tasker (Android)"}
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              {isIOS
                ? "L'app Raccourcis, déjà installée sur votre iPhone, envoie chaque SMS Wave ou Orange Money à Kpakpato, sans rien ouvrir. À régler une seule fois."
                : "Une app d'automatisation (MacroDroid, Tasker ou Notification Forwarder) envoie vos notifications et SMS à Kpakpato. Elle est à installer une fois sur le téléphone."}{" "}
              Les transactions s&apos;ajoutent à votre prochaine ouverture de Kpakpato.
            </p>
            {secret ? (
              <>
                <Steps
                  items={isIOS ? [
                    "Ouvrez Raccourcis → onglet Automatisation → « + » → Message. Dans « Le message contient », saisissez Wave, puis « Exécuter immédiatement » (refaites-le pour Orange Money).",
                    "Choisissez « Nouveau raccourci vierge » et ajoutez l'action « Obtenir le contenu de l'URL ».",
                    "URL : l'adresse ci-dessous. Touchez « Afficher plus » : Méthode POST, ajoutez l'en-tête Authorization avec la valeur ci-dessous.",
                    "Corps de la requête : JSON. Ajoutez un champ Texte nommé rawText et choisissez la variable « Contenu du message » ; ajoutez un champ sourceApp avec le mot Wave (ou Orange Money).",
                    "Validez. À chaque SMS Wave, le texte part tout seul vers Kpakpato.",
                  ] : [
                    "Dans l'app d'automatisation, créez une règle : déclencheur « Notification reçue » (Wave, Orange Money, MTN, Moov, Djamo) ou « SMS reçu ».",
                    "Action : « Requête HTTP » de type POST vers l'adresse ci-dessous.",
                    "Ajoutez l'en-tête Authorization avec la valeur ci-dessous.",
                    'Corps JSON : {"rawText": <texte de la notification ou du SMS>, "sourceApp": <nom de l\'app>} en insérant les variables proposées par l\'app.',
                  ]}
                />
                {(
                  [
                    ["Adresse (URL)", `${origin}/api/transactions/ingest`],
                    ["En-tête Authorization", `Bearer ${uid}.${secret}`],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="mt-2">
                    <p className="text-[11px] font-semibold text-slate-300">{label}</p>
                    <div className="mt-1 flex items-start gap-2">
                      <code className="block flex-1 break-all rounded-lg bg-slate-800 p-2 text-[11px] text-kpakpato-orange">
                        {value}
                      </code>
                      <button
                        onClick={() => copy(label, value)}
                        aria-label={`Copier ${label}`}
                        className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:text-white"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    {copied === label && <p className="mt-1 text-[11px] text-emerald-400">Copié.</p>}
                  </div>
                ))}
                <p className="mt-3 text-[11px] text-amber-400">
                  Gardez cette clé secrète : elle permet d&apos;ajouter des transactions à votre compte.
                </p>
                <button onClick={generateSecret} className="mt-2 text-[11px] text-slate-400 underline">
                  Régénérer la clé (l&apos;ancienne cesse de marcher)
                </button>
              </>
            ) : (
              <button
                onClick={generateSecret}
                className="mt-3 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
              >
                Générer mon lien de connexion
              </button>
            )}
          </section>
        )}

          </>
        )}

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
