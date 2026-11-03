"use client";

import React, { useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import WalletDetail from "@/components/WalletDetail";
import { CUSTOM_WALLET_COLORS, formatFCFA, parseFcfaInput } from "@/lib/finance-utils";
import { WalletId, WalletInfo } from "@/types/finance";
import {
  Wallet,
  Edit3,
  Check,
  X,
  Smartphone,
  CreditCard,
  Banknote,
  Eye,
  EyeOff,
  ArrowRightLeft,
  Trash2,
  Plus,
} from "lucide-react";

export default function WalletGrid() {
  const [detailId, setDetailId] = useState<WalletId | null>(null);
  const {
    wallets,
    totalBalance,
    transfers,
    updateWalletBalance,
    transferBetweenWallets,
    deleteTransfer,
    addWallet,
    renameWallet,
    deleteWallet,
  } = useFinance();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBalance, setNewBalance] = useState("");
  const [newColor, setNewColor] = useState(CUSTOM_WALLET_COLORS[0].color);
  const [addError, setAddError] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editingWallet, setEditingWallet] = useState<WalletId | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [hideBalances, setHideBalances] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [showTransfer, setShowTransfer] = useState(false);
  const [fromWallet, setFromWallet] = useState<WalletId>("wave");
  const [toWallet, setToWallet] = useState<WalletId>("djamo");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);

  // Les soldes négatifs (découvert) ne comptent pas dans la répartition proportionnelle.
  const positiveTotal = wallets.reduce((acc, w) => acc + Math.max(0, w.balance), 0);
  const walletName = (id: WalletId) => wallets.find((w) => w.id === id)?.shortName ?? id;

  const startEdit = (wallet: WalletInfo) => {
    setEditingWallet(wallet.id);
    setEditValue(String(wallet.balance));
    setEditName(wallet.shortName);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingWallet(null);
    setEditError(null);
  };

  const saveEdit = async (walletId: WalletId) => {
    const parsed = parseFcfaInput(editValue);
    if (parsed === null || parsed < 0) {
      setEditError("Entrez un montant valide (entier, 0 ou plus).");
      return;
    }
    const target = wallets.find((w) => w.id === walletId);
    if (target?.custom) {
      const err = renameWallet(walletId, editName);
      if (err) {
        setEditError(err);
        return;
      }
    }
    await updateWalletBalance(walletId, parsed);
    cancelEdit();
  };

  const removeWallet = (walletId: WalletId) => {
    const err = deleteWallet(walletId);
    if (err) setEditError(err);
    else cancelEdit();
  };

  const submitNewWallet = (e: React.FormEvent) => {
    e.preventDefault();
    const balance = newBalance.trim() === "" ? 0 : parseFcfaInput(newBalance);
    if (balance === null || balance < 0) {
      setAddError("Solde de départ invalide (entier, 0 ou plus).");
      return;
    }
    const err = addWallet(newName, balance, newColor);
    if (err) {
      setAddError(err);
      return;
    }
    setNewName("");
    setNewBalance("");
    setAddError(null);
    setShowAdd(false);
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFcfaInput(transferAmount);
    if (fromWallet === toWallet) {
      setTransferError("Choisissez deux portefeuilles différents.");
      return;
    }
    if (amount === null || amount <= 0) {
      setTransferError("Entrez un montant supérieur à 0.");
      return;
    }
    await transferBetweenWallets(fromWallet, toWallet, amount, transferNote);
    setTransferAmount("");
    setTransferNote("");
    setTransferError(null);
    setShowTransfer(false);
  };

  const getWalletIcon = (id: WalletId) => {
    if (id === "djamo") return <CreditCard className="w-5 h-5" />;
    if (id === "cash") return <Banknote className="w-5 h-5" />;
    return <Smartphone className="w-5 h-5" />;
  };

  return (
    <section className="space-y-4">
      {/* Carte Patrimoine Global */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl border border-slate-700/60">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-kpakpato-orange/20 blur-2xl" />
        <div className="absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-kpakpato-green/20 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Solde Total Agrégé ({wallets.length} Portefeuilles)
            </p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
              {hideBalances ? "••••••• FCFA" : formatFCFA(totalBalance)}
            </h2>
          </div>
          <button
            onClick={() => setHideBalances(!hideBalances)}
            className="rounded-full bg-white/10 p-2.5 text-slate-200 hover:bg-white/20 transition"
            title={hideBalances ? "Afficher les soldes" : "Masquer les soldes"}
          >
            {hideBalances ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {/* Barre de répartition proportionnelle */}
        <div className="mt-5">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-700/70 p-0.5 gap-0.5">
            {wallets.map((w) => {
              const pct = positiveTotal > 0 ? (Math.max(0, w.balance) / positiveTotal) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={w.id}
                  style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: w.color }}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500"
                  title={`${w.shortName}: ${Math.round(pct)}%`}
                />
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300">
            {wallets.map((w) => {
              const pct =
                positiveTotal > 0
                  ? Math.round((Math.max(0, w.balance) / positiveTotal) * 100)
                  : 0;
              return (
                <span key={w.id} className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: w.color }}
                  />
                  {w.shortName}: <strong>{pct}%</strong>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grille des 6 Portefeuilles Mobile Money / Djamo / Cash */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Wallet className="w-4 h-4 text-kpakpato-orange" />
          Mes Portefeuilles
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
          >
            <Plus className="w-3.5 h-3.5 text-kpakpato-orange" />
            Nouveau
          </button>
          <button
            onClick={() => setShowTransfer((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-kpakpato-orange" />
            Transférer
          </button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={submitNewWallet}
          className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4"
        >
          <p className="text-xs text-slate-400">
            Créez un portefeuille pour un projet, un coffre, un autre compte… (ex. « Projet terrain », « Ecobank »).
          </p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={24}
            placeholder="Nom du portefeuille"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-600"
          />
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            placeholder="Solde de départ en FCFA (0 par défaut)"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-600"
          />
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Couleur">
            {CUSTOM_WALLET_COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                role="radio"
                aria-checked={newColor === c.color}
                onClick={() => setNewColor(c.color)}
                style={{ backgroundColor: c.color }}
                className={`h-7 w-7 rounded-full ${newColor === c.color ? "ring-2 ring-white" : "opacity-70"}`}
              />
            ))}
          </div>
          {addError && <p className="text-xs font-semibold text-rose-400">{addError}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-kpakpato-green py-2 text-sm font-bold text-white hover:brightness-110 active:scale-95 transition"
          >
            Créer le portefeuille
          </button>
        </form>
      )}

      {showTransfer && (
        <form
          onSubmit={submitTransfer}
          className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { label: "De", value: fromWallet, set: setFromWallet },
                { label: "Vers", value: toWallet, set: setToWallet },
              ] as const
            ).map((field) => (
              <label key={field.label} className="text-xs text-slate-400">
                {field.label}
                <select
                  value={field.value}
                  onChange={(e) => field.set(e.target.value as WalletId)}
                  className="mt-1 w-full rounded-lg bg-slate-900 px-2 py-2 text-sm text-white outline-none ring-1 ring-slate-600"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.shortName}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="Montant en FCFA"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-600"
          />
          <input
            type="text"
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            placeholder="Note (optionnel)"
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-600"
          />
          {transferError && (
            <p className="text-xs font-semibold text-rose-400">{transferError}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-xl bg-kpakpato-green py-2 text-sm font-bold text-white hover:brightness-110 active:scale-95 transition"
          >
            Valider le transfert
          </button>
        </form>
      )}

      {detailId && <WalletDetail walletId={detailId} onClose={() => setDetailId(null)} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {wallets.map((wallet) => {
          const isEditing = editingWallet === wallet.id;
          return (
            <div
              key={wallet.id}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${wallet.bgGradient} p-4 ${wallet.textColor} shadow-md transition-transform active:scale-[0.99]`}
            >
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-black/15 p-2 backdrop-blur-xs">
                  {getWalletIcon(wallet.id)}
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => startEdit(wallet)}
                    className="rounded-lg bg-black/15 p-1.5 hover:bg-black/25 transition"
                    title={`Modifier solde ${wallet.shortName}`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => saveEdit(wallet.id)}
                      className="rounded-lg bg-emerald-500 p-1 text-white shadow"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg bg-rose-500 p-1 text-white shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3">
                {isEditing && wallet.custom ? (
                  <input
                    type="text"
                    value={editName}
                    maxLength={24}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg bg-black/30 px-2 py-1 text-xs font-semibold text-white outline-none ring-1 ring-white/40"
                  />
                ) : (
                  <p className="text-xs font-semibold opacity-85">{wallet.shortName}</p>
                )}
                {isEditing ? (
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-black/30 px-2 py-1 text-sm font-bold text-white outline-none ring-1 ring-white/40"
                    autoFocus
                  />
                ) : (
                  <p className="mt-0.5 text-lg font-extrabold tracking-tight">
                    {hideBalances ? "••••• FCFA" : formatFCFA(wallet.balance)}
                  </p>
                )}
              </div>

              {isEditing && wallet.custom && (
                <button
                  onClick={() => removeWallet(wallet.id)}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg bg-black/25 px-2 py-1 text-[10px] font-bold hover:bg-black/40"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer
                </button>
              )}
              {!isEditing && (
                <button
                  onClick={() => setDetailId(wallet.id)}
                  className="mt-2 rounded-lg bg-black/20 px-2 py-1 text-[10px] font-bold hover:bg-black/35"
                >
                  Voir le détail
                </button>
              )}
              {isEditing && editError ? (
                <p className="mt-2 text-[10px] font-semibold text-white">{editError}</p>
              ) : (
                <p className="mt-2 line-clamp-1 text-[10px] opacity-75">
                  {wallet.feeNote}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {transfers.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            Derniers transferts
          </h3>
          {transfers.slice(0, 3).map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl bg-slate-800/70 px-3 py-2 text-xs text-slate-200"
            >
              <span>
                {walletName(t.fromWalletId)} → {walletName(t.toWalletId)}
                {t.note ? ` · ${t.note}` : ""}
              </span>
              <span className="flex items-center gap-2 font-bold">
                {hideBalances ? "••••• FCFA" : formatFCFA(t.amount)}
                <button
                  onClick={() => deleteTransfer(t.id)}
                  title="Annuler ce transfert"
                  className="text-slate-400 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
