"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useFinance } from "@/context/FinanceContext";
import { db } from "@/lib/firebase";
import { type ContactMemory, partyKey } from "@/lib/smart-categorizer";

const STORAGE_KEY = "kpakpato_contacts_v1";

interface ContactsContextType {
  /** Ce que l'utilisateur a répondu pour ce numéro ou marchand, s'il l'a déjà fait. */
  lookup: (party: string | undefined) => ContactMemory | null;
  remember: (party: string, memory: ContactMemory) => Promise<void>;
  /** Numéros / marchands dont l'utilisateur a refusé de répondre pour l'instant. */
  dismissed: Set<string>;
  dismiss: (party: string) => void;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

const isMemory = (v: unknown): v is ContactMemory =>
  typeof v === "object" && v !== null && typeof (v as ContactMemory).category === "string" && typeof (v as ContactMemory).label === "string";

/**
 * Mémoire des numéros et marchands : une réponse donnée une fois classe toutes les futures opérations.
 * Stockée dans le document de l'utilisateur (champ knownContacts) et en local.
 */
export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const { user, cloudReady } = useFinance();
  const uid = user?.uid ?? null;
  const [contacts, setContacts] = useState<Record<string, ContactMemory>>({});
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      const local: Record<string, ContactMemory> = {};
      for (const [k, v] of Object.entries(raw)) if (isMemory(v)) local[k] = v;
      setContacts(local);
    } catch {
      // stockage indisponible : on repart d'une mémoire vide
    }
  }, []);

  // Réponses déjà données depuis un autre appareil.
  useEffect(() => {
    if (!uid || !cloudReady || !db) return;
    let cancelled = false;
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        const cloud = snap.data()?.knownContacts;
        if (cancelled || !cloud || typeof cloud !== "object") return;
        setContacts((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(cloud)) if (isMemory(v)) next[k] = v;
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [uid, cloudReady]);

  const persistLocal = (next: Record<string, ContactMemory>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignoré
    }
  };

  const lookup = useCallback(
    (party: string | undefined) => {
      const key = partyKey(party);
      return key ? contacts[key] ?? null : null;
    },
    [contacts]
  );

  const remember = useCallback(
    async (party: string, memory: ContactMemory) => {
      const key = partyKey(party);
      if (!key) return;
      setContacts((prev) => {
        const next = { ...prev, [key]: memory };
        persistLocal(next);
        return next;
      });
      if (uid && db) {
        await setDoc(doc(db, "users", uid), { knownContacts: { [key]: memory } }, { merge: true }).catch(() => undefined);
      }
    },
    [uid]
  );

  const dismiss = useCallback((party: string) => {
    const key = partyKey(party);
    if (key) setDismissedKeys((prev) => new Set(prev).add(key));
  }, []);

  const value = useMemo(
    () => ({ lookup, remember, dismissed: dismissedKeys, dismiss }),
    [lookup, remember, dismissedKeys, dismiss]
  );
  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts doit être utilisé dans ContactsProvider");
  return ctx;
}
