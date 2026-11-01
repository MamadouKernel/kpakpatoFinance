export type WalletId = "wave" | "orange" | "mtn" | "moov" | "djamo" | "cash";

export type TransactionType = "expense" | "income";

export type PeriodFilter = "day" | "week" | "month";

export type TransactionCategory =
  | "Nourriture & Garba"
  | "Transport (Yango/Gbaka/Wôrô)"
  | "Loyer & Factures (CIE/SODECI)"
  | "Data & Appels"
  | "Famille & Tontine"
  | "Sorties & Chill"
  | "Salaire"
  | "Gombo & Business"
  | "Épargne"
  | "Frais & Commissions"
  | "Autre";

export interface WalletInfo {
  id: WalletId;
  name: string;
  shortName: string;
  color: string;
  bgGradient: string;
  textColor: string;
  balance: number;
  feeNote: string;
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  walletId: WalletId;
  date: string; // ISO string
  note?: string;
  smsKey?: string; // empreinte du SMS importé (anti-doublon)
}

export interface Transfer {
  id: string;
  fromWalletId: WalletId;
  toWalletId: WalletId;
  amount: number;
  date: string; // ISO string
  note?: string;
  smsKey?: string;
}

export interface CommuneRentGuide {
  commune: string;
  vibe: string;
  studioAvg: number;
  deuxPiecesAvg: number;
  troisPiecesAvg: number;
  transportAvgMonthly: number;
  advice: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "kpakpato";
  content: string;
  timestamp: string;
}
