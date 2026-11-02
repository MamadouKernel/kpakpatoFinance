"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useFinance } from "@/context/FinanceContext";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { DEFAULT_OVERTIME_RATES, type OvertimeRates } from "@/lib/payroll";

export interface SalaryProfile {
  baseGross: number;
  taxableBonuses: number;
  hours: { first: number; beyond: number; night: number; holiday: number };
  rates: OvertimeRates;
  parts: number;
}

export const EMPTY_SALARY_PROFILE: SalaryProfile = {
  baseGross: 0,
  taxableBonuses: 0,
  hours: { first: 0, beyond: 0, night: 0, holiday: 0 },
  rates: DEFAULT_OVERTIME_RATES,
  parts: 1,
};

const KEY = "kpakpato_salary_v1";

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback);

/** Remet à plat des données lues (stockage local ou Firestore) : jamais de valeur invalide. */
function sanitize(raw: unknown): SalaryProfile {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, any>;
  const h = r.hours ?? {};
  const rt = r.rates ?? {};
  return {
    baseGross: num(r.baseGross),
    taxableBonuses: num(r.taxableBonuses),
    hours: { first: num(h.first), beyond: num(h.beyond), night: num(h.night), holiday: num(h.holiday) },
    rates: {
      first: num(rt.first, DEFAULT_OVERTIME_RATES.first),
      beyond: num(rt.beyond, DEFAULT_OVERTIME_RATES.beyond),
      night: num(rt.night, DEFAULT_OVERTIME_RATES.night),
      holiday: num(rt.holiday, DEFAULT_OVERTIME_RATES.holiday),
    },
    parts: Math.min(5, Math.max(1, num(r.parts, 1))),
  };
}

interface SalaryContextType {
  profile: SalaryProfile;
  setProfile: (next: SalaryProfile) => void;
}

const SalaryContext = createContext<SalaryContextType | undefined>(undefined);

export function SalaryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useFinance();
  const [profile, setProfileState] = useState<SalaryProfile>(EMPTY_SALARY_PROFILE);
  const [localLoaded, setLocalLoaded] = useState(false);
  // Évite d'écraser le cloud avant de l'avoir lu.
  const cloudReady = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setProfileState(sanitize(JSON.parse(saved)));
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
        const cloud = snap.data()?.salaryProfile;
        if (!cancelled && cloud) setProfileState(sanitize(cloud));
      })
      .catch((err) => console.warn("Salaire : lecture cloud impossible", err))
      .finally(() => {
        if (!cancelled) cloudReady.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [user, localLoaded]);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const setProfile = (next: SalaryProfile) => {
    setProfileState(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // sans importance
    }
    if (!db || !user || !cloudReady.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDoc(doc(db!, "users", user.uid), { salaryProfile: next }, { merge: true }).catch((err) =>
        console.warn("Salaire : sauvegarde cloud impossible", err)
      );
    }, 800);
  };

  return <SalaryContext.Provider value={{ profile, setProfile }}>{children}</SalaryContext.Provider>;
}

export function useSalary() {
  const ctx = useContext(SalaryContext);
  if (!ctx) throw new Error("useSalary must be used within a SalaryProvider");
  return ctx;
}
