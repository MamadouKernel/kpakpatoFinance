"use client";

import React, { useEffect, useState } from "react";
import WalletGrid from "@/components/WalletGrid";
import TransactionTracker from "@/components/TransactionTracker";
import KpakpatoAdvisor from "@/components/KpakpatoAdvisor";
import InstallButton from "@/components/InstallButton";
import UpdateBanner from "@/components/UpdateBanner";
import SpaceSwitch from "@/components/SpaceSwitch";
import GenderOnboarding from "@/components/GenderOnboarding";
import CoupleSpace from "@/components/CoupleSpace";
import { useHousehold } from "@/context/HouseholdContext";
import { useFinance } from "@/context/FinanceContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  Wallet,
  BarChart3,
  Bot,
  Cloud,
  LogIn,
  LogOut,
  RotateCcw,
} from "lucide-react";

type MainTab = "dashboard" | "transactions" | "kpakpato";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const { user, isCloudSynced, authLoading, signInWithGoogle, signOutUser, resetData } =
    useFinance();
  const { space, profile, profileLoaded } = useHousehold();
  const [signInError, setSignInError] = useState<string | null>(null);

  // Register PWA Service Worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
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
                ? `Synchronisé Firebase (${user?.displayName || user?.email})`
                : "Mode Local Rapide • FCFA"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <InstallButton compact />
          <button
            onClick={resetData}
            title="Effacer toutes les données"
            className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-slate-400 hover:text-white transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

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
      <main className="flex-1 space-y-6 px-4 pt-4">
        {activeTab === "dashboard" && space === "couple" && isCloudSynced && <CoupleSpace />}

        {activeTab === "dashboard" && !(space === "couple" && isCloudSynced) && (
          <>
            <WalletGrid />
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

        {activeTab === "kpakpato" && <KpakpatoAdvisor />}
      </main>

      {/* Barre de Navigation Mobile (Bottom Tab Bar PWA) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-lg">
        <div className="mx-auto grid max-w-xl grid-cols-3 px-4 py-2">
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
            <span>Jour / Sem / Mois</span>
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
