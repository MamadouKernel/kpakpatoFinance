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
  | "Virement interne au foyer"
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

export type Gender = "femme" | "homme" | "autre";

export interface UserProfile {
  gender: Gender;
  /** Précision obligatoire quand gender === "autre". */
  genderOther?: string;
}

export interface HouseholdMember {
  name: string;
  gender?: Gender;
  genderOther?: string;
  /** Numéro Mobile Money du membre : sert à reconnaître les virements entre conjoints. */
  phone?: string;
  /** Nom tel qu'il apparaît dans les SMS (ex. "KONATE AMINATA"). */
  alias?: string;
}

export type HouseholdStatus = "active" | "dissolved" | "cancelled";

export interface Household {
  id: string;
  name: string;
  memberIds: string[];
  members: Record<string, HouseholdMember>;
  inviteCode: string;
  /** Budget mensuel partagé en FCFA (0 = non défini). */
  monthlyBudget: number;
  status: HouseholdStatus;
  createdAt?: string;
  endedAt?: string;
  endedBy?: string;
  /** Qui a mis fin au foyer : nom et genre, figés au moment de la dissociation. */
  endedByName?: string;
  endedByGender?: Gender;
  endedByGenderOther?: string;
}

/** Trace d'un ancien foyer, conservée dans le compte de chaque ex-membre. */
export interface PastHousehold {
  id: string;
  name: string;
  partnerName: string;
  startedAt?: string;
  endedAt: string;
  endedByMe: boolean;
  endedByName?: string;
  endedByGender?: Gender;
  endedByGenderOther?: string;
}
