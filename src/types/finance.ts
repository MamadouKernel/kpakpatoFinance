export type BuiltinWalletId = "wave" | "orange" | "mtn" | "moov" | "djamo" | "cash";

/** Identifiant d'un portefeuille : l'un des 6 par défaut, ou celui d'un portefeuille créé par l'utilisateur. */
export type WalletId = string;

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
  /** Portefeuille créé par l'utilisateur (modifiable et supprimable). */
  custom?: boolean;
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
  tontineId?: string; // cotisation rattachée à une tontine
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
  /** Nom d'affichage choisi par l'utilisateur (sinon celui de son compte Google). */
  name?: string;
  /** Numéro Mobile Money, pour reconnaître les virements entre conjoints. */
  phone?: string;
  /** Nom tel qu'il apparaît dans les SMS. */
  alias?: string;
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
  /** Fin de validité du code (ms epoch) ; absent sur les anciens foyers. */
  inviteExpiresAt?: number;
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

export type TontineFrequency = "weekly" | "monthly";

export interface Tontine {
  id: string;
  name: string;
  /** Cotisation par tour, en FCFA. */
  contribution: number;
  frequency: TontineFrequency;
  /** Nombre de participants : la cagnotte d'un tour = cotisation × participants. */
  members: number;
  /** Portefeuille habituel de la cotisation. */
  walletId: WalletId;
  /** Date à laquelle je reçois la cagnotte (ISO), si connue. */
  payoutDate?: string;
}

export interface CommunityData {
  tontines: Tontine[];
  /** Enveloppe mensuelle d'aide à la famille (« taxe familiale »), 0 = non définie. */
  solidarityBudget: number;
}
