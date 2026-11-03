"use client";

import { useMemo } from "react";
import { useFinance } from "@/context/FinanceContext";
import { useHousehold } from "@/context/HouseholdContext";
import { INTERNAL_CATEGORY } from "@/lib/finance-utils";
import { isPartnerParty } from "@/lib/household-utils";
import { type ParsedSms, smsKey, smsSubtype } from "@/lib/sms-parser";
import type { TransactionCategory, WalletId } from "@/types/finance";

export function describeSms(sms: ParsedSms): string {
  switch (sms.kind) {
    case "om_transfer":
    case "wave_send":
      return `Transfert vers ${sms.recipient}`;
    case "om_payment":
      return sms.merchant ? `Paiement ${sms.merchant}` : "Paiement Orange Money";
    case "wave_payment":
      return `Paiement ${sms.merchant}`;
    case "wave_receive":
      return `Reçu de ${sms.sender}`;
    case "generic_debit":
      return sms.merchant ? `Paiement ${sms.merchant}` : "Compte débité";
    case "generic_credit":
      return "Compte crédité";
    default:
      return `Dépôt depuis ${sms.bank}`;
  }
}

export const isFromDjamo = (sms: ParsedSms) => sms.kind === "wave_deposit" && /djamo/i.test(sms.bank ?? "");

export interface PreparedSms {
  sms: ParsedSms;
  key: string;
  duplicate: boolean;
  /** Argent échangé avec le conjoint : classé « Virement interne au foyer ». */
  internal: boolean;
}

/**
 * Prépare puis importe des SMS / notifications analysés : détection des doublons et du conjoint,
 * création des opérations, des frais, et recalage du solde annoncé par l'opérateur.
 * Utilisé par l'écran d'import (manuel) et par l'import automatique.
 */
export function useSmsImporter() {
  const { wallets, transactions, transfers, addTransaction, transferBetweenWallets, updateWalletBalance } =
    useFinance();
  const { partner } = useHousehold();

  const knownKeys = useMemo(() => {
    const keys = new Set<string>();
    transactions.forEach((t) => t.smsKey && keys.add(t.smsKey));
    transfers.forEach((t) => t.smsKey && keys.add(t.smsKey));
    return keys;
  }, [transactions, transfers]);

  const walletName = (id: WalletId) => wallets.find((w) => w.id === id)?.shortName ?? id;

  const isWithPartner = (sms: ParsedSms) => {
    if (sms.kind === "om_transfer" || sms.kind === "wave_send") return isPartnerParty(sms.recipient, partner);
    if (sms.kind === "wave_receive") return isPartnerParty(sms.sender, partner);
    return false;
  };

  const prepare = (parsed: ParsedSms[], walletOverrides: Record<string, WalletId> = {}): PreparedSms[] =>
    parsed.map((sms) => {
      const key = smsKey(sms);
      return {
        sms: { ...sms, walletId: walletOverrides[key] ?? sms.walletId },
        key,
        duplicate: knownKeys.has(key),
        internal: isWithPartner(sms),
      };
    });

  /** Éléments à importer : ni déjà importés, ni en double dans le lot. */
  const importable = (items: PreparedSms[]) =>
    items.filter((i, idx) => !i.duplicate && items.findIndex((o) => o.key === i.key) === idx);

  const importItems = async (
    items: PreparedSms[],
    categories: Record<string, TransactionCategory> = {}
  ): Promise<{ count: number; recalibrated: boolean }> => {
    // Du plus ancien au plus récent : le solde final est celui du dernier SMS.
    const ordered = [...items].sort((a, b) => (a.sms.date ?? "").localeCompare(b.sms.date ?? ""));
    for (const { sms, key, internal } of ordered) {
      const note = `Importé depuis SMS${sms.fee > 0 ? ` (frais ${sms.fee} FCFA)` : ""}`;
      if (isFromDjamo(sms)) {
        await transferBetweenWallets("djamo", sms.walletId, sms.amount, note, { date: sms.date, smsKey: key });
      } else {
        await addTransaction({
          title: internal ? `Virement interne au foyer (${describeSms(sms).toLowerCase()})` : describeSms(sms),
          amount: sms.amount,
          type: sms.type,
          category: internal ? INTERNAL_CATEGORY : categories[key] ?? "Autre",
          walletId: sms.walletId,
          date: sms.date,
          note,
          smsKey: key,
          // Firestore refuse les valeurs undefined : on n'ajoute le champ que pour une dépense.
          ...(smsSubtype(sms) ? { subtype: smsSubtype(sms) } : {}),
        });
      }
      if (sms.fee > 0) {
        await addTransaction({
          title: `Frais ${walletName(sms.walletId)}`,
          amount: sms.fee,
          type: "expense",
          category: "Frais & Commissions",
          walletId: sms.walletId,
          date: sms.date,
        });
      }
      // Le solde annoncé par l'opérateur fait foi : il recale le portefeuille.
      if (sms.balance !== null) await updateWalletBalance(sms.walletId, sms.balance);
    }
    return { count: ordered.length, recalibrated: ordered.some(({ sms }) => sms.balance !== null) };
  };

  return { wallets, walletName, prepare, importable, importItems };
}
