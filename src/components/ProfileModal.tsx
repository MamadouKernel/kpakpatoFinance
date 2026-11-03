"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useHousehold } from "@/context/HouseholdContext";
import { LockSettings } from "@/components/LockSetup";
import { deleteMyAccount } from "@/lib/delete-account";
import { GENDER_LABELS } from "@/lib/household-utils";
import type { Gender } from "@/types/finance";

const GENDERS: Gender[] = ["femme", "homme", "autre"];
const field =
  "w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-slate-600 focus:ring-kpakpato-orange";

/** Modification du profil : nom, genre, numéro Mobile Money et nom tel qu'il apparaît dans les SMS. */
export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, signOutUser } = useFinance();
  const { profile, saveProfile, household, leaveHousehold } = useHousehold();
  const [name, setName] = useState(profile?.name || user?.displayName || "");
  const [gender, setGender] = useState<Gender>(profile?.gender ?? "femme");
  const [other, setOther] = useState(profile?.genderOther ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [alias, setAlias] = useState(profile?.alias ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const removeAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount(Boolean(household), leaveHousehold);
      await signOutUser();
      onClose();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setDeleteError(
        code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
          ? "Confirmation Google annulée : rien n'a été supprimé."
          : e instanceof Error
            ? e.message
            : "Suppression impossible."
      );
      setDeleting(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await saveProfile({ name, gender, genderOther: other, phone, alias });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mon profil"
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">Mon profil</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" title="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">Compte Google : {user?.email}</p>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            Nom affiché
            <input className={`${field} mt-1`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </label>

          <div>
            <p className="text-xs font-semibold text-slate-300">Vous êtes</p>
            <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Genre">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  role="radio"
                  aria-checked={gender === g}
                  onClick={() => setGender(g)}
                  className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${
                    gender === g
                      ? "border-kpakpato-orange bg-kpakpato-orange/15 text-white"
                      : "border-slate-700 bg-slate-900 text-slate-300"
                  }`}
                >
                  {GENDER_LABELS[g]}
                </button>
              ))}
            </div>
            {gender === "autre" && (
              <input
                className={`${field} mt-2`}
                value={other}
                maxLength={40}
                placeholder="Précisez (obligatoire)"
                onChange={(e) => setOther(e.target.value)}
              />
            )}
          </div>

          <label className="block text-xs font-semibold text-slate-300">
            Numéro Mobile Money
            <input
              className={`${field} mt-1`}
              inputMode="tel"
              value={phone}
              placeholder="Ex. 07 01 02 03 04"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label className="block text-xs font-semibold text-slate-300">
            Nom dans les SMS
            <input
              className={`${field} mt-1`}
              value={alias}
              placeholder="Ex. KONATE AMINATA"
              onChange={(e) => setAlias(e.target.value)}
            />
            <span className="mt-1 block text-[11px] font-normal text-slate-500">
              Sert à reconnaître les virements entre conjoints. Plusieurs noms possibles, séparés par « ; ».
            </span>
          </label>
        </div>

        <div className="mt-5 border-t border-slate-800 pt-4">
          <h3 className="mb-2 text-sm font-bold text-white">Verrouillage de l&apos;application</h3>
          <LockSettings />
        </div>

        {error && <p className="mt-3 text-xs font-semibold text-rose-400">{error}</p>}
        {saved && <p className="mt-3 text-xs font-semibold text-emerald-400">Profil enregistré.</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-2xl bg-kpakpato-orange py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>

        <div className="mt-5 border-t border-slate-800 pt-4">
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="text-xs font-semibold text-rose-400 underline">
              Supprimer mon compte
            </button>
          ) : (
            <div className="space-y-2 rounded-2xl border border-rose-500/40 bg-rose-500/5 p-3">
              <p className="text-xs font-bold text-rose-300">Supprimer mon compte</p>
              <p className="text-[11px] leading-snug text-slate-300">
                Vos portefeuilles, opérations, tontines et votre profil seront effacés définitivement, ainsi que votre compte de
                connexion. {household ? "Votre Espace Couple sera aussi dissocié. " : ""}Cette action est irréversible. Google
                vous demandera de confirmer votre identité.
              </p>
              <input
                className={field}
                value={confirmText}
                placeholder="Tapez SUPPRIMER pour confirmer"
                onChange={(e) => setConfirmText(e.target.value)}
              />
              {deleteError && <p className="text-[11px] font-semibold text-amber-400">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={removeAccount}
                  disabled={deleting || confirmText.trim().toUpperCase() !== "SUPPRIMER"}
                  className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {deleting ? "Suppression…" : "Supprimer définitivement"}
                </button>
                <button
                  onClick={() => {
                    setShowDelete(false);
                    setConfirmText("");
                    setDeleteError(null);
                  }}
                  disabled={deleting}
                  className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        <a
          href="/confidentialite"
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-center text-[11px] text-slate-500 underline"
        >
          Politique de confidentialité
        </a>
      </div>
    </div>,
    document.body
  );
}
