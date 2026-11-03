/**
 * Une même transaction arrive souvent deux fois : la notification de l'app (Wave, Orange Money…) puis le SMS.
 * Les textes diffèrent, donc l'empreinte du texte ne suffit pas : on compare ce que l'opération a de stable
 * (portefeuille, sens, montant, solde annoncé, heure).
 */

export interface OpSignature {
  walletId: string;
  type: string;
  amount: number;
  /** Solde annoncé après l'opération, quand le message le donne. */
  balance: number | null;
  /** Instant de l'opération (heure lue dans le message, sinon heure d'arrivée), en millisecondes. */
  at: number;
  /** Clé issue d'un identifiant de transaction (« sms-tx-… ») : deux identifiants différents = deux opérations. */
  txKey?: string;
}

/** Sans solde ni identifiant, deux messages aussi proches sont la même opération. */
const CLOSE_MS = 5 * 60_000;
/** Avec le même solde annoncé, c'est la même opération même si l'un des deux a été importé bien plus tard. */
const SAME_BALANCE_MS = 24 * 60 * 60_000;

export const txKeyOf = (smsKeyValue: string | undefined) =>
  smsKeyValue?.startsWith("sms-tx-") ? smsKeyValue : undefined;

export function sameOperation(a: OpSignature, b: OpSignature): boolean {
  if (a.walletId !== b.walletId || a.type !== b.type || a.amount !== b.amount) return false;
  if (a.txKey && b.txKey) return a.txKey === b.txKey;
  const gap = Math.abs(a.at - b.at);
  if (a.balance !== null && b.balance !== null) return a.balance === b.balance && gap < SAME_BALANCE_MS;
  return gap < CLOSE_MS;
}
