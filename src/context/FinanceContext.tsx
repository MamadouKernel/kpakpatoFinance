"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Transaction,
  Transfer,
  WalletId,
  WalletInfo,
} from "@/types/finance";
import {
  CUSTOM_WALLET_COLORS,
  DEFAULT_WALLETS,
  buildCustomWallet,
  INITIAL_TRANSACTIONS,
  generateId,
  mergeCloudAndLocal,
  sanitizeTransactions,
  sanitizeTransfers,
  sanitizeWallets,
  transactionDelta,
} from "@/lib/finance-utils";
import {
  auth,
  db,
  googleProvider,
  isFirebaseConfigured,
} from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  waitForPendingWrites,
  setDoc,
} from "firebase/firestore";

interface FinanceContextType {
  wallets: WalletInfo[];
  transactions: Transaction[];
  transfers: Transfer[];
  totalBalance: number;
  user: User | null;
  isCloudSynced: boolean;
  authLoading: boolean;
  /** Vrai quand la fusion cloud/local est terminée (le cloud peut être écrit sans rien écraser). */
  cloudReady: boolean;
  addTransaction: (tx: Omit<Transaction, "id" | "date"> & { date?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateWalletBalance: (walletId: WalletId, newBalance: number) => Promise<void>;
  transferBetweenWallets: (
    fromWalletId: WalletId,
    toWalletId: WalletId,
    amount: number,
    note?: string,
    options?: { date?: string; smsKey?: string }
  ) => Promise<void>;
  deleteTransfer: (id: string) => Promise<void>;
  /** Crée un portefeuille personnalisé. Renvoie une erreur lisible, ou null si tout va bien. */
  addWallet: (name: string, initialBalance: number, color: string) => string | null;
  renameWallet: (id: WalletId, name: string, color?: string) => string | null;
  /** Supprime un portefeuille personnalisé, seulement s'il n'a aucune opération. */
  deleteWallet: (id: WalletId) => string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  WALLETS: "kpakpato_wallets_v1",
  TRANSACTIONS: "kpakpato_transactions_v1",
  TRANSFERS: "kpakpato_transfers_v1",
};

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<WalletInfo[]>(DEFAULT_WALLETS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  // Vrai tant que Firebase Auth n'a pas répondu (évite d'afficher l'écran de connexion à tort).
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  // Vrai uniquement une fois la fusion cloud/local terminée : évite d'écraser Firestore avant la lecture.
  const [cloudReady, setCloudReady] = useState(false);
  // Incrémenté au retour du réseau : relance la lecture du cloud si elle avait échoué hors ligne.
  const [syncAttempt, setSyncAttempt] = useState(0);

  // Dernier état connu, lisible depuis les callbacks asynchrones (auth) sans valeurs figées.
  const latest = useRef({ wallets, transactions, transfers });
  latest.current = { wallets, transactions, transfers };

  // Load from localStorage on client mount (données validées avant usage)
  useEffect(() => {
    try {
      const savedWallets = localStorage.getItem(STORAGE_KEYS.WALLETS);
      const savedTx = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const savedTransfers = localStorage.getItem(STORAGE_KEYS.TRANSFERS);
      if (savedWallets) {
        setWallets(sanitizeWallets(JSON.parse(savedWallets)));
      }
      if (savedTx) {
        setTransactions(sanitizeTransactions(JSON.parse(savedTx)));
      }
      if (savedTransfers) {
        setTransfers(sanitizeTransfers(JSON.parse(savedTransfers)));
      }
    } catch (e) {
      console.error("Failed to read local storage:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Listen to Firebase Auth state if configured
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      setCloudReady(false);
      if (!currentUser || !db) return;
      try {
        const userDocRef = doc(collection(db, "users"), currentUser.uid);
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data();
          const merged = mergeCloudAndLocal(
            {
              wallets: sanitizeWallets(data.wallets),
              transactions: sanitizeTransactions(data.transactions),
              transfers: sanitizeTransfers(data.transfers),
            },
            latest.current
          );
          setWallets(merged.wallets);
          setTransactions(merged.transactions);
          setTransfers(merged.transfers);
        }
        // Si aucun document cloud : l'état local sera poussé par l'effet de persistance.
        setCloudReady(true);
      } catch (err) {
        // En cas d'échec de lecture on n'active PAS l'écriture cloud, pour ne rien écraser.
        console.warn("Firestore sync error:", err);
      }
    });
    return () => unsubscribe();
  }, [syncAttempt]);

  const cloudReadyRef = useRef(false);
  cloudReadyRef.current = cloudReady;

  useEffect(() => {
    // Seulement si la première lecture n'avait pas abouti : sinon on referait une fusion inutile.
    const retry = () => {
      if (!cloudReadyRef.current) setSyncAttempt((n) => n + 1);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  // Persist changes to LocalStorage & Firestore
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(transfers));
    } catch (e) {
      console.error("Local save error:", e);
    }

    if (user && db && isFirebaseConfigured && cloudReady) {
      const userDocRef = doc(collection(db, "users"), user.uid);
      setDoc(
        userDocRef,
        {
          wallets,
          transactions,
          transfers,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch((err) => console.warn("Firestore write warning:", err));
    }
  }, [wallets, transactions, transfers, isLoaded, user, cloudReady]);

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

  const applyDelta = (walletId: WalletId, delta: number) =>
    setWallets((prev) =>
      prev.map((w) => (w.id === walletId ? { ...w, balance: w.balance + delta } : w))
    );

  const addTransaction = async (
    txInput: Omit<Transaction, "id" | "date"> & { date?: string }
  ) => {
    if (!Number.isFinite(txInput.amount) || txInput.amount <= 0) return;
    const newTx: Transaction = {
      ...txInput,
      id: generateId("tx"),
      date: txInput.date || new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);
    applyDelta(newTx.walletId, transactionDelta(newTx));
  };

  const deleteTransaction = async (id: string) => {
    const target = transactions.find((t) => t.id === id);
    if (!target) return;

    setTransactions((prev) => prev.filter((t) => t.id !== id));
    applyDelta(target.walletId, -transactionDelta(target));
  };

  const updateWalletBalance = async (walletId: WalletId, newBalance: number) => {
    if (!Number.isFinite(newBalance)) return;
    const rounded = Math.round(newBalance);
    setWallets((prev) =>
      prev.map((w) => (w.id === walletId ? { ...w, balance: rounded } : w))
    );
  };

  const transferBetweenWallets = async (
    fromWalletId: WalletId,
    toWalletId: WalletId,
    amount: number,
    note?: string,
    options?: { date?: string; smsKey?: string }
  ) => {
    if (fromWalletId === toWalletId || !Number.isFinite(amount) || amount <= 0) return;
    const transfer: Transfer = {
      id: generateId("tr"),
      fromWalletId,
      toWalletId,
      amount: Math.round(amount),
      date: options?.date || new Date().toISOString(),
      note: note?.trim() || undefined,
      smsKey: options?.smsKey,
    };
    setTransfers((prev) => [transfer, ...prev]);
    applyDelta(fromWalletId, -transfer.amount);
    applyDelta(toWalletId, transfer.amount);
  };

  const deleteTransfer = async (id: string) => {
    const target = transfers.find((t) => t.id === id);
    if (!target) return;
    setTransfers((prev) => prev.filter((t) => t.id !== id));
    applyDelta(target.fromWalletId, target.amount);
    applyDelta(target.toWalletId, -target.amount);
  };

  const nameTaken = (name: string, exceptId?: WalletId) =>
    wallets.some(
      (w) => w.id !== exceptId && w.shortName.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const addWallet = (name: string, initialBalance: number, color: string) => {
    const label = name.trim();
    if (!label) return "Donnez un nom au portefeuille.";
    if (nameTaken(label)) return "Un portefeuille porte déjà ce nom.";
    if (wallets.length >= 20) return "Maximum 20 portefeuilles.";
    if (!Number.isFinite(initialBalance) || initialBalance < 0) return "Solde de départ invalide.";
    const palette = CUSTOM_WALLET_COLORS.some((c) => c.color === color) ? color : undefined;
    setWallets((prev) => [
      ...prev,
      buildCustomWallet(generateId("w"), label, Math.round(initialBalance), palette),
    ]);
    return null;
  };

  const renameWallet = (id: WalletId, name: string, color?: string) => {
    const target = wallets.find((w) => w.id === id);
    if (!target?.custom) return "Seuls vos portefeuilles personnalisés peuvent être renommés.";
    const label = name.trim();
    if (!label) return "Donnez un nom au portefeuille.";
    if (nameTaken(label, id)) return "Un portefeuille porte déjà ce nom.";
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? buildCustomWallet(w.id, label, w.balance, color ?? w.color) : w))
    );
    return null;
  };

  const deleteWallet = (id: WalletId) => {
    const target = wallets.find((w) => w.id === id);
    if (!target?.custom) return "Les 6 portefeuilles de base ne peuvent pas être supprimés.";
    const used =
      transactions.some((t) => t.walletId === id) ||
      transfers.some((t) => t.fromWalletId === id || t.toWalletId === id);
    if (used) {
      return "Ce portefeuille a des opérations : supprimez-les d'abord (ou gardez-le, il peut rester à 0).";
    }
    setWallets((prev) => prev.filter((w) => w.id !== id));
    return null;
  };

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      alert(
        "Mode Démo Local actif : Configurez vos clés NEXT_PUBLIC_FIREBASE_* dans .env.local pour activer la connexion Google Firebase."
      );
      return;
    }
    await signInWithPopup(auth, googleProvider);
  };

  const signOutUser = async () => {
    if (auth) {
      // Opérations pas encore envoyées au cloud : on les laisse partir, ou on prévient l'utilisateur hors ligne.
      if (db) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const ok = window.confirm(
            "Vous êtes hors ligne : les opérations pas encore envoyées seront perdues si vous quittez. Quitter quand même ?"
          );
          if (!ok) return;
        } else {
          await Promise.race([waitForPendingWrites(db), new Promise((r) => setTimeout(r, 5000))]).catch(() => undefined);
        }
      }
      await fbSignOut(auth);
      // Les données restent dans le cloud : on vide l'appareil pour qu'elles ne soient ni visibles ni mélangées au compte suivant.
      try {
        Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
      } catch {
        // stockage indisponible
      }
      setWallets(DEFAULT_WALLETS);
      setTransactions(INITIAL_TRANSACTIONS);
      setTransfers([]);
    }
  };

  return (
    <FinanceContext.Provider
      value={{
        wallets,
        transactions,
        transfers,
        totalBalance,
        user,
        isCloudSynced: Boolean(user && isFirebaseConfigured),
        authLoading,
        cloudReady,
        addTransaction,
        deleteTransaction,
        updateWalletBalance,
        transferBetweenWallets,
        deleteTransfer,
        addWallet,
        renameWallet,
        deleteWallet,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance must be used within a FinanceProvider");
  }
  return context;
}
