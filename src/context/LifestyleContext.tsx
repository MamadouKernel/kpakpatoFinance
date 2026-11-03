"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useFinance } from "@/context/FinanceContext";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { EMPTY_LIFESTYLE, sanitizeLifestyle, type LifestyleData } from "@/lib/lifestyle";

const KEY = "kpakpato_lifestyle_v1";

interface LifestyleContextType {
  data: LifestyleData;
  update: (change: (prev: LifestyleData) => LifestyleData) => void;
}

const LifestyleContext = createContext<LifestyleContextType | undefined>(undefined);

/** Dettes, tontines, événements et relevé du compteur CIE : enregistrés sur l'appareil et dans le compte. */
export function LifestyleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useFinance();
  const [data, setData] = useState<LifestyleData>(EMPTY_LIFESTYLE);
  const [localLoaded, setLocalLoaded] = useState(false);
  // Évite d'écraser le cloud avant de l'avoir lu.
  const cloudReady = useRef(false);
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setData(sanitizeLifestyle(JSON.parse(saved)));
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
        const cloud = snap.data()?.lifestyle;
        if (!cancelled && cloud) {
          const clean = sanitizeLifestyle(cloud);
          setData(clean);
          try {
            localStorage.setItem(KEY, JSON.stringify(clean));
          } catch {
            // ignoré
          }
        }
      })
      .catch((err) => console.warn("Vie quotidienne : lecture cloud impossible", err))
      .finally(() => {
        if (!cancelled) cloudReady.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [user, localLoaded]);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const update: LifestyleContextType["update"] = (change) => {
    const next = change(latest.current);
    setData(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // sans importance
    }
    if (!db || !user || !cloudReady.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDoc(doc(db!, "users", user.uid), { lifestyle: next }, { merge: true }).catch((err) =>
        console.warn("Vie quotidienne : sauvegarde cloud impossible", err)
      );
    }, 800);
  };

  return <LifestyleContext.Provider value={{ data, update }}>{children}</LifestyleContext.Provider>;
}

export function useLifestyle() {
  const ctx = useContext(LifestyleContext);
  if (!ctx) throw new Error("useLifestyle doit être utilisé dans LifestyleProvider");
  return ctx;
}
