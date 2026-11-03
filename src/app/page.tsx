"use client";

import React, { useEffect, useState } from "react";
import WalletGrid from "@/components/WalletGrid";
import TransactionTracker from "@/components/TransactionTracker";
import WeeklyReport from "@/components/WeeklyReport";
import AndroidOnboarding from "@/components/AndroidOnboarding";
import ContactPrompt from "@/components/ContactPrompt";
import FixedBillsAlert from "@/components/FixedBillsAlert";
import TontineSection from "@/components/TontineSection";
import KpakpatoAdvisor from "@/components/KpakpatoAdvisor";
import InstallButton from "@/components/InstallButton";
import UpdateBanner from "@/components/UpdateBanner";
import OfflineBanner from "@/components/OfflineBanner";
import ClipboardWatcher from "@/components/ClipboardWatcher";
import { setPendingImport } from "@/lib/import-inbox";
import { isNativeApp, nativeStatus } from "@/lib/native-bridge";
import IncomeBonus from "@/components/IncomeBonus";
import AbidjanPlanner from "@/components/AbidjanPlanner";
import SpaceSwitch from "@/components/SpaceSwitch";
import GenderOnboarding from "@/components/GenderOnboarding";
import CoupleSpace from "@/components/CoupleSpace";
import ProfileModal from "@/components/ProfileModal";
import PhoneConnect from "@/components/PhoneConnect";
import CompanionInbox from "@/components/CompanionInbox";
import { useHousehold } from "@/context/HouseholdContext";
import { useFinance } from "@/context/FinanceContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  Wallet,
  BarChart3,
  Bot,
  Banknote,
  Cloud,
  LogIn,
  LogOut,
  RotateCcw,
  UserCircle,
  Smartphone,
  ClipboardPaste,
} from "lucide-react";

type MainTab = "dashboard" | "transactions" | "income" | "kpakpato";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const { user, isCloudSynced, authLoading, signInWithGoogle, signOutUser } =
    useFinance();
  const { space, profile, profileLoaded } = useHousehold();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  // App Android : état des autorisations (null hors de l'app).
  const [listening, setListening] = useState<null | { notifications: boolean; sms: boolean; smsSupported: boolean }>(null);
  useEffect(() => {
    if (!isNativeApp()) return;
    const refresh = () => setListening(nativeStatus());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [showPhone]);

  // Texte partagé vers l'app (Android : Partager → Kpakpato) : on le dépose pour l'import.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Raccourcis de l'icône (appui long) : /?action=import ouvre l'import, /?action=add ouvre les opérations.
    const action = params.get("action");
    if (action === "import" || action === "add") {
      if (action === "import") setPendingImport(""); // « texte vide en attente » = ouvrir l'écran d'import
      setActiveTab("transactions");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    const shared = (params.get("text") || params.get("title") || "").trim();
    if (!shared) return;
    setPendingImport(shared);
    setActiveTab("transactions");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Register PWA Service Worker
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration skipped:", err));
    }
  }, []);

  // Connexion Google obligatoire dès que Firebase est configuré.
  if (isFirebaseConfigured) {
    if (authLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
          Chargement…
          <UpdateBanner autoReload />
        </div>
      );
    }
    if (!user) {
      return (
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-kpakpato-orange to-kpakpato-green text-2xl font-black text-white shadow-md">
            KF
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Kpakpato <span className="text-kpakpato-orange">Finance</span>
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Connectez-vous avec Google pour accéder à vos portefeuilles.
            </p>
          </div>
          <button
            onClick={() =>
              signInWithGoogle().catch((err) =>
                setSignInError(err?.code || "Connexion impossible")
              )
            }
            className="inline-flex items-center gap-2 rounded-2xl bg-kpakpato-orange px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            <LogIn className="h-4 w-4" />
            Se connecter avec Google
          </button>
          {signInError && (
            <p className="text-xs text-rose-400">Erreur : {signInError}</p>
          )}
          <InstallButton />
          <UpdateBanner autoReload />
        </div>
      );
    }
  }

  // Première connexion : le genre est demandé avant d'entrer dans l'app.
  if (isFirebaseConfigured && user) {
    if (!profileLoaded) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
          Chargement…
        </div>
      );
    }
    if (!profile) return <GenderOnboarding />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col bg-slate-950 pb-24">
      <UpdateBanner />
      <OfflineBanner />
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showPhone && <PhoneConnect onClose={() => setShowPhone(false)} onImport={() => setActiveTab("transactions")} />}
      <CompanionInbox />
      <ClipboardWatcher onImport={() => setActiveTab("transactions")} />
      {/* Header Mobile PWA */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/90 px-4 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-kpakpato-orange to-kpakpato-green font-black text-white shadow-md">
            KF
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold tracking-tight text-white">
                Kpakpato <span className="text-kpakpato-orange">Finance</span>
              </h1>
              <span className="rounded-md bg-kpakpato-green/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                CI 🇨🇮
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isCloudSynced
                ? profile?.name || user?.displayName || user?.email
                : "Non connecté"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <InstallButton compact />
          <button
            onClick={() => window.location.reload()}
            title="Actualiser l'application"
            aria-label="Actualiser l'application"
            className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-slate-400 hover:text-white transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {isCloudSynced && (
            <button
              onClick={() => setShowPhone(true)}
              title="Importer depuis mon téléphone"
              aria-label="Importer depuis mon téléphone"
              className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-slate-400 hover:text-white transition"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          )}

          {isCloudSynced && (
            <button
              onClick={() => setShowProfile(true)}
              title="Mon profil"
              aria-label="Mon profil"
              className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-slate-400 hover:text-white transition"
            >
              <UserCircle className="w-4 h-4" />
            </button>
          )}

          {user ? (
            <button
              onClick={signOutUser}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              Quitter
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 hover:border-kpakpato-orange transition"
            >
              <Cloud className="w-3.5 h-3.5 text-kpakpato-orange" />
              <span className="hidden xs:inline">Sync</span> Firebase
              <LogIn className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </header>

      {isCloudSynced && <SpaceSwitch />}

      {/* Contenu Principal */}
      <AndroidOnboarding />

      <main className="flex-1 space-y-6 px-4 pt-4">
        {activeTab === "dashboard" && space === "couple" && isCloudSynced && <CoupleSpace />}

        {activeTab === "dashboard" && !(space === "couple" && isCloudSynced) && (
          <>
            <WalletGrid />
            <ContactPrompt />
            <WeeklyReport />
            <FixedBillsAlert />
            <TontineSection />
            {/* Carte d'appel rapide au conseiller Kpakpato */}
            <div
              onClick={() => setActiveTab("kpakpato")}
              className="cursor-pointer rounded-2xl bg-gradient-to-r from-kpakpato-orange/20 via-amber-500/15 to-kpakpato-green/20 border border-kpakpato-orange/40 p-4 flex items-center justify-between hover:border-kpakpato-orange transition"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-kpakpato-orange text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-white">
                    Demander l&apos;avis de Kpakpato IA
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Audit FCFA, calcul Salaire Brut/Net CI & loyer par commune à Abidjan →
                  </p>
                </div>
              </div>
            </div>
            <TransactionTracker />
          </>
        )}

        {activeTab === "transactions" && <TransactionTracker />}

        {activeTab === "income" && (
          <>
            <IncomeBonus />
            <AbidjanPlanner />
          </>
        )}

        {activeTab === "kpakpato" && <KpakpatoAdvisor />}
      </main>

      {/* Barre de Navigation Mobile (Bottom Tab Bar PWA) */}
      {activeTab === "dashboard" && !listening && (
        <button
          onClick={async () => {
            try {
              const text = (await navigator.clipboard.readText()).trim();
              setPendingImport(text);
            } catch {
              setPendingImport("");
            }
            setActiveTab("transactions");
          }}
          className="fixed bottom-20 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-kpakpato-orange px-4 py-3 text-xs font-bold text-white shadow-lg transition hover:opacity-90 active:scale-95"
          aria-label="Coller un SMS ou une notification"
        >
          <ClipboardPaste className="h-4 w-4" />
          Coller SMS
        </button>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-lg">
        <div className="mx-auto grid max-w-xl grid-cols-4 px-2 py-2">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 text-xs font-bold transition ${
              activeTab === "dashboard"
                ? "text-kpakpato-orange"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span>Portefeuilles</span>
          </button>

          <button
            onClick={() => setActiveTab("transactions")}
            className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 text-xs font-bold transition ${
              activeTab === "transactions"
                ? "text-kpakpato-orange"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span>Stats</span>
          </button>

          <button
            onClick={() => setActiveTab("income")}
            className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 text-xs font-bold transition ${
              activeTab === "income"
                ? "text-kpakpato-orange"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Banknote className="w-5 h-5" />
            <span>Revenus</span>
          </button>

          <button
            onClick={() => setActiveTab("kpakpato")}
            className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 text-xs font-bold transition ${
              activeTab === "kpakpato"
                ? "text-kpakpato-green"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bot className="w-5 h-5" />
            <span>Kpakpato IA</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
