"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useFinance } from "@/context/FinanceContext";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { generateId } from "@/lib/finance-utils";
import type { CommunityData, Tontine, TontineFrequency, WalletId } from "@/types/finance";

const KEY = "kpakpato_community_v1";
const WALLETS: WalletId[] = ["wave", "orange", "mtn", "moov", "djamo", "cash"];
const EMPTY: CommunityData = { tontines: [], solidarityBudget: 0 };

function sanitize(raw: unknown): CommunityData {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, any>;
  const tontines: Tontine[] = Array.isArray(r.tontines)
    ? r.tontines
        .filter(
          (t: any) =>
            t &&
            typeof t.id === "string" &&
            typeof t.name === "string" &&
            Number.isFinite(t.contribution) &&
            t.contribution > 0 &&
            (t.frequency === "weekly" || t.frequency === "monthly")
        )
        .map((t: any) => ({
          id: t.id,
          name: t.name.slice(0, 60),
          contribution: Math.round(t.contribution),
          frequency: t.frequency as TontineFrequency,
          members: Number.isFinite(t.members) && t.members >= 2 ? Math.round(t.members) : 2,
          walletId: WALLETS.includes(t.walletId) ? t.walletId : "wave",
          ...(typeof t.payoutDate === "string" && !Number.isNaN(new Date(t.payoutDate).getTime())
            ? { payoutDate: t.payoutDate }
            : {}),
        }))
    : [];
  return {
    tontines,
    solidarityBudget: Number.isFinite(r.solidarityBudget) && r.solidarityBudget > 0 ? Math.round(r.solidarityBudget) : 0,
  };
}

interface CommunityContextType extends CommunityData {
  addTontine: (t: Omit<Tontine, "id">) => void;
  removeTontine: (id: string) => void;
  setSolidarityBudget: (amount: number) => void;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export function CommunityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useFinance();
  const [data, setData] = useState<CommunityData>(EMPTY);
  const [localLoaded, setLocalLoaded] = useState(false);
  const cloudReady = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setData(sanitize(JSON.parse(saved)));
    } catch {
      // stockage indisponible
    }
    setLocalLoaded(true);
  }, []);

  useEffect(() => {
    cloudReady.current = false;
    if (!isFirebaseConfigured || !db || !user || !localLoaded) return;
    let cancelled = false;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const cloud = snap.data()?.community;
        if (!cancelled && cloud) setData(sanitize(cloud));
      })
      .catch((err) => console.warn("Tontines : lecture cloud impossible", err))
      .finally(() => {
        if (!cancelled) cloudReady.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [user, localLoaded]);

  const commit = (next: CommunityData) => {
    setData(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // sans importance
    }
    if (!db || !user || !cloudReady.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDoc(doc(db!, "users", user.uid), { community: next }, { merge: true }).catch((err) =>
        console.warn("Tontines : sauvegarde cloud impossible", err)
      );
    }, 800);
  };

  return (
    <CommunityContext.Provider
      value={{
        ...data,
        addTontine: (t) => commit({ ...data, tontines: [...data.tontines, { ...t, id: generateId("tn") }] }),
        removeTontine: (id) => commit({ ...data, tontines: data.tontines.filter((t) => t.id !== id) }),
        setSolidarityBudget: (amount) =>
          commit({ ...data, solidarityBudget: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0 }),
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error("useCommunity must be used within a CommunityProvider");
  return ctx;
}
