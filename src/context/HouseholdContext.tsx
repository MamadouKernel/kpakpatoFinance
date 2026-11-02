"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useFinance } from "@/context/FinanceContext";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { generateInviteCode } from "@/lib/household-utils";
import { sanitizeTransactions, sanitizeWallets } from "@/lib/finance-utils";
import type { Household, HouseholdMember, Transaction, WalletInfo } from "@/types/finance";

export type Space = "personal" | "couple";

export interface MemberData {
  wallets: WalletInfo[];
  transactions: Transaction[];
  updatedAt?: string;
}

interface HouseholdContextType {
  space: Space;
  setSpace: (space: Space) => void;
  household: Household | null;
  partnerUid: string | null;
  partner: HouseholdMember | null;
  partnerData: MemberData | null;
  loading: boolean;
  createHousehold: (name: string, profile: Omit<HouseholdMember, "name">) => Promise<void>;
  joinHousehold: (code: string, profile: Omit<HouseholdMember, "name">) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  updateMyProfile: (profile: Omit<HouseholdMember, "name">) => Promise<void>;
  setMonthlyBudget: (amount: number) => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

const SPACE_KEY = "kpakpato_space_v1";
/** Nombre d'opérations recopiées pour le conjoint (le document Firestore reste petit). */
const MIRROR_TX_LIMIT = 400;

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, wallets, transactions, cloudReady } = useFinance();
  const [space, setSpaceState] = useState<Space>("personal");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [partnerData, setPartnerData] = useState<MemberData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SPACE_KEY) === "couple") setSpaceState("couple");
    } catch {
      // stockage indisponible : on reste sur l'espace personnel
    }
  }, []);

  const setSpace = (next: Space) => {
    setSpaceState(next);
    try {
      localStorage.setItem(SPACE_KEY, next);
    } catch {
      // sans importance
    }
  };

  const uid = user?.uid ?? null;
  const active = Boolean(isFirebaseConfigured && db && uid);

  // Foyer rattaché à mon compte.
  useEffect(() => {
    if (!active || !db || !uid) {
      setHouseholdId(null);
      setHousehold(null);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        setHouseholdId((snap.data()?.householdId as string | undefined) ?? null);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [active, uid]);

  // Document du foyer.
  useEffect(() => {
    if (!db || !householdId) {
      setHousehold(null);
      return;
    }
    return onSnapshot(
      doc(db, "households", householdId),
      (snap) => {
        const d = snap.data();
        if (!snap.exists() || !d) return setHousehold(null);
        setHousehold({
          id: snap.id,
          name: d.name ?? "Notre foyer",
          memberIds: Array.isArray(d.memberIds) ? d.memberIds : [],
          members: d.members ?? {},
          inviteCode: d.inviteCode ?? "",
          monthlyBudget: typeof d.monthlyBudget === "number" ? d.monthlyBudget : 0,
        });
      },
      // Accès refusé : je ne fais plus partie de ce foyer.
      () => setHousehold(null)
    );
  }, [householdId]);

  const partnerUid = useMemo(
    () => household?.memberIds.find((id) => id !== uid) ?? null,
    [household, uid]
  );
  const partner = partnerUid ? household?.members[partnerUid] ?? null : null;

  // Données partagées par mon conjoint.
  useEffect(() => {
    if (!db || !householdId || !partnerUid) {
      setPartnerData(null);
      return;
    }
    return onSnapshot(
      doc(db, "households", householdId, "memberData", partnerUid),
      (snap) => {
        const d = snap.data();
        if (!d) return setPartnerData(null);
        setPartnerData({
          wallets: sanitizeWallets(d.wallets),
          transactions: sanitizeTransactions(d.transactions),
          updatedAt: d.updatedAt,
        });
      },
      () => setPartnerData(null)
    );
  }, [householdId, partnerUid]);

  // Je recopie mes soldes et mes dernières opérations pour mon conjoint.
  useEffect(() => {
    if (!db || !household || !uid || !cloudReady) return;
    const timer = setTimeout(() => {
      setDoc(doc(db!, "households", household.id, "memberData", uid), {
        wallets,
        transactions: transactions.slice(0, MIRROR_TX_LIMIT),
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.warn("Foyer : partage des données impossible", err));
    }, 800);
    return () => clearTimeout(timer);
  }, [household, uid, cloudReady, wallets, transactions]);

  const requireAuth = () => {
    if (!db || !uid || !user) throw new Error("Connectez-vous pour utiliser l'Espace Couple.");
    return { database: db, uid, displayName: user.displayName || user.email || "Moi" };
  };

  const cleanProfile = (profile: Omit<HouseholdMember, "name">) => ({
    ...(profile.phone?.trim() ? { phone: profile.phone.trim() } : {}),
    ...(profile.alias?.trim() ? { alias: profile.alias.trim() } : {}),
  });

  const createHousehold: HouseholdContextType["createHousehold"] = async (name, profile) => {
    const { database, uid: me, displayName } = requireAuth();
    const ref = doc(collection(database, "households"));
    const inviteCode = generateInviteCode();
    await setDoc(ref, {
      name: name.trim() || "Notre foyer",
      memberIds: [me],
      members: { [me]: { name: displayName, ...cleanProfile(profile) } },
      inviteCode,
      monthlyBudget: 0,
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(database, "householdInvites", inviteCode), {
      householdId: ref.id,
      ownerUid: me,
    });
    await setDoc(doc(database, "users", me), { householdId: ref.id }, { merge: true });
  };

  const joinHousehold: HouseholdContextType["joinHousehold"] = async (rawCode, profile) => {
    const { database, uid: me, displayName } = requireAuth();
    const code = rawCode.trim().toUpperCase();
    const invite = await getDoc(doc(database, "householdInvites", code));
    const hid = invite.data()?.householdId as string | undefined;
    if (!invite.exists() || !hid) throw new Error("Code invalide. Vérifiez-le auprès de votre conjoint(e).");
    try {
      await updateDoc(doc(database, "households", hid), {
        memberIds: arrayUnion(me),
        [`members.${me}`]: { name: displayName, ...cleanProfile(profile) },
        lastJoinCode: code,
      });
    } catch {
      throw new Error("Impossible de rejoindre ce foyer (déjà complet ou code expiré).");
    }
    await setDoc(doc(database, "users", me), { householdId: hid }, { merge: true });
  };

  const leaveHousehold = async () => {
    const { database, uid: me } = requireAuth();
    if (!household) return;
    await deleteDoc(doc(database, "households", household.id, "memberData", me)).catch(() => undefined);
    await updateDoc(doc(database, "households", household.id), {
      memberIds: arrayRemove(me),
      [`members.${me}`]: deleteField(),
    });
    await setDoc(doc(database, "users", me), { householdId: deleteField() }, { merge: true });
    setSpace("personal");
  };

  const updateMyProfile: HouseholdContextType["updateMyProfile"] = async (profile) => {
    const { database, uid: me, displayName } = requireAuth();
    if (!household) return;
    await updateDoc(doc(database, "households", household.id), {
      [`members.${me}`]: { name: displayName, ...cleanProfile(profile) },
    });
  };

  const setMonthlyBudget = async (amount: number) => {
    const { database } = requireAuth();
    if (!household || !Number.isFinite(amount) || amount < 0) return;
    await updateDoc(doc(database, "households", household.id), {
      monthlyBudget: Math.round(amount),
    });
  };

  return (
    <HouseholdContext.Provider
      value={{
        space,
        setSpace,
        household,
        partnerUid,
        partner,
        partnerData,
        loading,
        createHousehold,
        joinHousehold,
        leaveHousehold,
        updateMyProfile,
        setMonthlyBudget,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (!context) throw new Error("useHousehold must be used within a HouseholdProvider");
  return context;
}
