"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { describeGender, generateInviteCode } from "@/lib/household-utils";
import { sanitizeTransactions, sanitizeWallets } from "@/lib/finance-utils";
import type {
  Gender,
  Household,
  HouseholdMember,
  PastHousehold,
  Transaction,
  UserProfile,
  WalletInfo,
} from "@/types/finance";

/** Durée de vie d'un code d'invitation : 24 h. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

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
  /** Genre choisi à la création du compte (null tant que non renseigné). */
  profile: UserProfile | null;
  /** Faux tant que le document utilisateur n'a pas été lu. */
  profileLoaded: boolean;
  saveGender: (gender: Gender, other?: string) => Promise<void>;
  /** Modifie mon profil (nom, genre, numéro, nom dans les SMS) et le répercute dans mon foyer. */
  saveProfile: (p: { name: string; gender: Gender; genderOther?: string; phone?: string; alias?: string }) => Promise<void>;
  pastHouseholds: PastHousehold[];
  /** Message à afficher quand le foyer vient d'être dissocié (par l'autre membre ou par moi). */
  endedNotice: string | null;
  dismissEndedNotice: () => void;
  createHousehold: (name: string, profile: Omit<HouseholdMember, "name">) => Promise<void>;
  joinHousehold: (code: string, profile: Omit<HouseholdMember, "name">) => Promise<void>;
  /** Met fin au foyer : plus personne ne voit les données de l'autre, la trace est conservée. */
  leaveHousehold: () => Promise<void>;
  /** Remplace le code d'invitation (expiré ou perdu) par un nouveau, valable INVITE_TTL_MS. */
  regenerateInvite: () => Promise<void>;
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
  const [rawHousehold, setRawHousehold] = useState<Household | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [pastHouseholds, setPastHouseholds] = useState<PastHousehold[]>([]);
  const [endedNotice, setEndedNotice] = useState<string | null>(null);
  const archivedRef = useRef<string | null>(null);
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

  // Mon document : foyer rattaché, genre, anciens foyers.
  useEffect(() => {
    if (!active || !db || !uid) {
      setHouseholdId(null);
      setRawHousehold(null);
      setProfile(null);
      setProfileLoaded(false);
      setPastHouseholds([]);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d = snap.data();
        setHouseholdId((d?.householdId as string | undefined) ?? null);
        setProfile(
          d?.gender === "femme" || d?.gender === "homme" || d?.gender === "autre"
            ? {
                gender: d.gender,
                genderOther: d.genderOther,
                name: typeof d.profileName === "string" ? d.profileName : undefined,
                phone: typeof d.phone === "string" ? d.phone : undefined,
                alias: typeof d.alias === "string" ? d.alias : undefined,
              }
            : null
        );
        setPastHouseholds(Array.isArray(d?.pastHouseholds) ? d.pastHouseholds : []);
        setProfileLoaded(true);
        setLoading(false);
      },
      () => {
        setProfileLoaded(true);
        setLoading(false);
      }
    );
  }, [active, uid]);

  // Document du foyer.
  useEffect(() => {
    if (!db || !householdId) {
      setRawHousehold(null);
      return;
    }
    return onSnapshot(
      doc(db, "households", householdId),
      (snap) => {
        const d = snap.data();
        if (!snap.exists() || !d) return setRawHousehold(null);
        setRawHousehold({
          id: snap.id,
          name: d.name ?? "Notre foyer",
          memberIds: Array.isArray(d.memberIds) ? d.memberIds : [],
          members: d.members ?? {},
          inviteCode: d.inviteCode ?? "",
          inviteExpiresAt: typeof d.inviteExpiresAt === "number" ? d.inviteExpiresAt : undefined,
          monthlyBudget: typeof d.monthlyBudget === "number" ? d.monthlyBudget : 0,
          status: d.status === "dissolved" || d.status === "cancelled" ? d.status : "active",
          createdAt: d.createdAt,
          endedAt: d.endedAt,
          endedBy: d.endedBy,
          endedByName: d.endedByName,
          endedByGender: d.endedByGender,
          endedByGenderOther: d.endedByGenderOther,
        });
      },
      // Accès refusé : je ne fais plus partie de ce foyer.
      () => setRawHousehold(null)
    );
  }, [householdId]);

  // Seul un foyer actif est exposé à l'app : un foyer dissocié n'est plus qu'une trace.
  const household = rawHousehold?.status === "active" ? rawHousehold : null;

  // Foyer dissocié (par moi ou par l'autre) : je range la trace dans mon compte,
  // je retire mes données du foyer et je repars sans foyer.
  useEffect(() => {
    if (!db || !uid || !rawHousehold || rawHousehold.status !== "dissolved") return;
    if (archivedRef.current === rawHousehold.id) return;
    archivedRef.current = rawHousehold.id;

    const otherId = rawHousehold.memberIds.find((id) => id !== uid);
    // Qui a dissocié : valeurs figées à la dissociation, sinon profil du membre concerné.
    const ender = rawHousehold.endedBy ? rawHousehold.members[rawHousehold.endedBy] : undefined;
    const endedByName = rawHousehold.endedByName || ender?.name;
    const endedByGender = rawHousehold.endedByGender || ender?.gender;
    const endedByGenderOther = rawHousehold.endedByGenderOther || ender?.genderOther;
    const entry: PastHousehold = {
      id: rawHousehold.id,
      name: rawHousehold.name,
      partnerName: (otherId && rawHousehold.members[otherId]?.name) || "",
      endedAt: rawHousehold.endedAt || new Date().toISOString(),
      endedByMe: rawHousehold.endedBy === uid,
      ...(endedByName ? { endedByName } : {}),
      ...(endedByGender ? { endedByGender } : {}),
      ...(endedByGender === "autre" && endedByGenderOther ? { endedByGenderOther } : {}),
      ...(rawHousehold.createdAt ? { startedAt: rawHousehold.createdAt } : {}),
    };
    const who = describeGender(endedByGender, endedByGenderOther).toLowerCase();

    (async () => {
      try {
        await deleteDoc(doc(db!, "households", rawHousehold.id, "memberData", uid)).catch(() => undefined);
        await setDoc(
          doc(db!, "users", uid),
          { householdId: deleteField(), pastHouseholds: arrayUnion(entry) },
          { merge: true }
        );
        setEndedNotice(
          entry.endedByMe
            ? "Foyer dissocié. Vos données ne sont plus visibles par votre ex-conjoint(e), et inversement."
            : `${endedByName || "Votre conjoint(e)"}${who ? ` (${who})` : ""} a mis fin au foyer. Vos données ne sont plus partagées.`
        );
        setSpaceState("personal");
      } catch (err) {
        archivedRef.current = null;
        console.warn("Foyer : archivage impossible", err);
      }
    })();
  }, [rawHousehold, uid]);

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
    return { database: db, uid, displayName: profile?.name || user.displayName || user.email || "Moi" };
  };

  const cleanProfile = (extra: Omit<HouseholdMember, "name">) => ({
    ...(profile ? { gender: profile.gender } : {}),
    ...(profile?.gender === "autre" && profile.genderOther ? { genderOther: profile.genderOther } : {}),
    ...((extra.phone?.trim() || profile?.phone) ? { phone: (extra.phone?.trim() || profile?.phone) as string } : {}),
    ...((extra.alias?.trim() || profile?.alias) ? { alias: (extra.alias?.trim() || profile?.alias) as string } : {}),
  });

  const saveGender: HouseholdContextType["saveGender"] = async (gender, other) => {
    const { database, uid: me } = requireAuth();
    const precision = other?.trim();
    if (gender === "autre" && !precision) throw new Error("Veuillez préciser.");
    await setDoc(
      doc(database, "users", me),
      { gender, genderOther: gender === "autre" ? precision : deleteField() },
      { merge: true }
    );
  };

  const saveProfile: HouseholdContextType["saveProfile"] = async (p) => {
    const { database, uid: me } = requireAuth();
    const name = p.name.trim();
    const precision = p.genderOther?.trim();
    if (!name) throw new Error("Le nom ne peut pas être vide.");
    if (p.gender === "autre" && !precision) throw new Error("Veuillez préciser.");
    const phone = p.phone?.trim();
    const alias = p.alias?.trim();
    await setDoc(
      doc(database, "users", me),
      {
        profileName: name,
        gender: p.gender,
        genderOther: p.gender === "autre" ? precision : deleteField(),
        phone: phone || deleteField(),
        alias: alias || deleteField(),
      },
      { merge: true }
    );
    if (household) {
      await updateDoc(doc(database, "households", household.id), {
        [`members.${me}`]: {
          name,
          gender: p.gender,
          ...(p.gender === "autre" && precision ? { genderOther: precision } : {}),
          ...(phone ? { phone } : {}),
          ...(alias ? { alias } : {}),
        },
      });
    }
  };

  const createHousehold: HouseholdContextType["createHousehold"] = async (name, extra) => {
    const { database, uid: me, displayName } = requireAuth();
    const ref = doc(collection(database, "households"));
    const inviteCode = generateInviteCode();
    const inviteExpiresAt = Date.now() + INVITE_TTL_MS;
    await setDoc(ref, {
      name: name.trim() || "Notre foyer",
      memberIds: [me],
      members: { [me]: { name: displayName, ...cleanProfile(extra) } },
      inviteCode,
      inviteExpiresAt,
      monthlyBudget: 0,
      status: "active",
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(database, "householdInvites", inviteCode), {
      householdId: ref.id,
      ownerUid: me,
      expiresAt: inviteExpiresAt,
    });
    await setDoc(doc(database, "users", me), { householdId: ref.id }, { merge: true });
  };

  const joinHousehold: HouseholdContextType["joinHousehold"] = async (rawCode, extra) => {
    const { database, uid: me, displayName } = requireAuth();
    const code = rawCode.trim().toUpperCase();
    const invite = await getDoc(doc(database, "householdInvites", code));
    const hid = invite.data()?.householdId as string | undefined;
    if (!invite.exists() || !hid) throw new Error("Code invalide. Vérifiez-le auprès de votre conjoint(e).");
    const expiresAt = invite.data()?.expiresAt;
    if (typeof expiresAt === "number" && Date.now() > expiresAt) {
      throw new Error("Ce code a expiré. Demandez à votre partenaire d'en générer un nouveau.");
    }
    try {
      await updateDoc(doc(database, "households", hid), {
        memberIds: arrayUnion(me),
        [`members.${me}`]: { name: displayName, ...cleanProfile(extra) },
        lastJoinCode: code,
      });
    } catch {
      throw new Error("Impossible de rejoindre ce foyer (déjà complet ou code expiré).");
    }
    await setDoc(doc(database, "users", me), { householdId: hid }, { merge: true });
  };

  const regenerateInvite = async () => {
    const { database, uid: me } = requireAuth();
    if (!household || household.memberIds.length >= 2) return;
    const inviteCode = generateInviteCode();
    const inviteExpiresAt = Date.now() + INVITE_TTL_MS;
    await setDoc(doc(database, "householdInvites", inviteCode), {
      householdId: household.id,
      ownerUid: me,
      expiresAt: inviteExpiresAt,
    });
    await updateDoc(doc(database, "households", household.id), { inviteCode, inviteExpiresAt });
    await deleteDoc(doc(database, "householdInvites", household.inviteCode)).catch(() => undefined);
  };

  const leaveHousehold = async () => {
    const { database, uid: me } = requireAuth();
    if (!household) return;
    const ref = doc(database, "households", household.id);
    const alone = household.memberIds.length < 2;

    if (alone) {
      // Invitation jamais utilisée : on annule simplement, sans laisser d'historique.
      await updateDoc(ref, { status: "cancelled", endedAt: new Date().toISOString(), endedBy: me });
      await deleteDoc(doc(database, "householdInvites", household.inviteCode)).catch(() => undefined);
      await deleteDoc(doc(ref, "memberData", me)).catch(() => undefined);
      await setDoc(doc(database, "users", me), { householdId: deleteField() }, { merge: true });
      setSpace("personal");
      return;
    }

    // Couple : le foyer est dissocié pour les deux. Le nettoyage de chaque compte
    // (retrait des données partagées, archivage) est fait par l'effet ci-dessus.
    const self = household.members[me];
    await updateDoc(ref, {
      status: "dissolved",
      endedAt: new Date().toISOString(),
      endedBy: me,
      endedByName: self?.name || user?.displayName || user?.email || "",
      ...(profile ? { endedByGender: profile.gender } : {}),
      ...(profile?.gender === "autre" && profile.genderOther ? { endedByGenderOther: profile.genderOther } : {}),
    });
    await deleteDoc(doc(database, "householdInvites", household.inviteCode)).catch(() => undefined);
  };

  const updateMyProfile: HouseholdContextType["updateMyProfile"] = async (extra) => {
    const { database, uid: me, displayName } = requireAuth();
    const phone = extra.phone?.trim();
    const alias = extra.alias?.trim();
    // Même valeurs dans « Mon profil » et dans l'Espace Couple.
    await setDoc(
      doc(database, "users", me),
      { phone: phone || deleteField(), alias: alias || deleteField() },
      { merge: true }
    );
    if (!household) return;
    await updateDoc(doc(database, "households", household.id), {
      [`members.${me}`]: { name: displayName, ...cleanProfile(extra) },
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
        profile,
        profileLoaded,
        saveProfile,
        saveGender,
        pastHouseholds,
        endedNotice,
        dismissEndedNotice: () => setEndedNotice(null),
        createHousehold,
        joinHousehold,
        leaveHousehold,
        regenerateInvite,
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
