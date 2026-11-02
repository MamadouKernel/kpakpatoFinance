"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Download, Share2, Smartphone, X } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { useFinance } from "@/context/FinanceContext";
import { db } from "@/lib/firebase";

/** Fichier à déposer dans public/ après avoir construit l'app compagnon (voir android-companion/README.md). */
const APK_PATH = "/kpakpato-compagnon.apk";

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
export default function PhoneConnect({ onClose }: { onClose: () => void }) {
  const { user } = useFinance();
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [apkReady, setApkReady] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isAndroid, setIsAndroid] = useState(true);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIsAndroid(/android/i.test(navigator.userAgent));
    fetch(APK_PATH, { method: "HEAD" })
      .then((r) => setApkReady(r.ok && !(r.headers.get("content-type") ?? "").includes("text/html")))
      .catch(() => setApkReady(false));
  }, []);

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
      aria-label="Connecter mon téléphone"
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-white">
            <Smartphone className="h-5 w-5 text-kpakpato-orange" />
            Connecter mon téléphone
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" title="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Faites arriver vos transactions Wave, Orange Money, MTN et Moov dans Kpakpato sans les ressaisir.
        </p>

        <div
          className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
            lastAt ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-800 text-slate-300"
          }`}
        >
          <CheckCircle2 className={`h-4 w-4 shrink-0 ${lastAt ? "text-emerald-400" : "text-slate-500"}`} />
          {lastAt ? `Téléphone connecté · dernier message le ${formatLast(lastAt)}` : "Aucun message reçu du téléphone pour l'instant."}
        </div>

        {/* Mode 1 : partage depuis la PWA */}
        <section className="mt-5 rounded-2xl border border-slate-700/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Share2 className="h-4 w-4 text-kpakpato-green" />
            Option 1 · Partager le message (sans rien télécharger)
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

        {/* Mode 2 : app compagnon */}
        <section className="mt-3 rounded-2xl border border-slate-700/70 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Smartphone className="h-4 w-4 text-kpakpato-orange" />
            Option 2 · Capture automatique (Android)
          </h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Une petite app lit les notifications et SMS de transaction et les envoie ici toute seule.
          </p>

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
              {apkReady === null
                ? "Vérification…"
                : "Le téléchargement n'est pas encore publié sur cette plateforme."}
            </p>
          )}

          <Steps
            items={[
              "Téléchargez l'app, ouvrez le fichier et autorisez l'installation depuis cette source si Android le demande.",
              "Ouvrez « Kpakpato Compagnon » et connectez-vous avec le même compte Google que sur Kpakpato.",
              "Appuyez sur « Autoriser l'accès aux notifications » et activez Kpakpato Compagnon dans la liste.",
              "Appuyez sur « Autoriser la lecture des SMS » et acceptez.",
              "Sur Tecno, Infinix ou Xiaomi : excluez l'app de l'économiseur de batterie, sinon Android peut l'arrêter.",
            ]}
          />
          <p className="mt-3 text-[11px] text-slate-500">
            Seuls les messages qui contiennent un montant en FCFA et un mot d&apos;opération sont envoyés, et uniquement
            vers votre compte. L&apos;import dans vos portefeuilles se fait quand vous ouvrez Kpakpato.
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
