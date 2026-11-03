import type { WalletInfo } from "@/types/finance";

export type FeeAction = "envoi" | "paiement" | "retrait";

export const FEE_ACTION_LABELS: Record<FeeAction, string> = {
  envoi: "Envoyer de l'argent",
  paiement: "Payer un marchand",
  retrait: "Retirer des espèces",
};

/**
 * Taux de frais INDICATIFS (en %) par portefeuille et par action. Les opérateurs changent leurs barèmes :
 * l'utilisateur peut corriger chaque taux dans l'app. Wave et le paiement marchand sont ceux affichés dans l'app.
 */
export const DEFAULT_FEE_RATES: Record<string, Record<FeeAction, number>> = {
  wave: { envoi: 1, paiement: 0, retrait: 1 },
  orange: { envoi: 1, paiement: 0, retrait: 1 },
  mtn: { envoi: 1, paiement: 0, retrait: 1 },
  moov: { envoi: 1, paiement: 0, retrait: 1 },
  djamo: { envoi: 0, paiement: 0, retrait: 1 },
  cash: { envoi: 0, paiement: 0, retrait: 0 },
};

export const rateFor = (rates: Record<string, Record<FeeAction, number>>, walletId: string, action: FeeAction): number =>
  rates[walletId]?.[action] ?? DEFAULT_FEE_RATES[walletId]?.[action] ?? 1;

export interface FeeOption {
  wallet: WalletInfo;
  fee: number;
  /** Solde suffisant pour couvrir le montant et les frais. */
  affordable: boolean;
}

/** Portefeuilles classés du moins cher au plus cher, ceux qui ont assez de solde d'abord. Le Cash ne sert pas à envoyer de l'argent. */
export function compareFees(
  wallets: WalletInfo[],
  amount: number,
  action: FeeAction,
  rates: Record<string, Record<FeeAction, number>>
): FeeOption[] {
  return wallets
    .filter((w) => !(w.id === "cash" && action !== "paiement"))
    .map((wallet) => {
      const fee = Math.round((amount * rateFor(rates, wallet.id, action)) / 100);
      return { wallet, fee, affordable: wallet.balance >= amount + fee };
    })
    .sort((a, b) => Number(b.affordable) - Number(a.affordable) || a.fee - b.fee || b.wallet.balance - a.wallet.balance);
}
