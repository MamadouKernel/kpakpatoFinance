import type { TransactionType, WalletId } from "@/types/finance";

export type SmsKind = "om_transfer" | "om_payment" | "wave_deposit";

export interface ParsedSms {
  kind: SmsKind;
  walletId: WalletId;
  type: TransactionType;
  amount: number;
  fee: number;
  /** Solde du portefeuille après l'opération, tel qu'annoncé par l'opérateur. */
  balance: number;
  /** Destinataire (transfert Orange Money). */
  recipient?: string;
  /** Compte source (dépôt Wave). */
  bank?: string;
  /** Date ISO lue dans le SMS, si présente. */
  date?: string;
  /** Texte normalisé, utilisé pour détecter les doublons. */
  raw: string;
}

// Un montant : "1500", "1 500", "1.500", "1,500", "1.500,50", "12,5".
// Les groupes de milliers doivent compter exactement 3 chiffres et ne pas être
// suivis d'un chiffre, pour ne pas avaler une date collée au montant ("0 2025-03-12").
const NUM =
  "(\\d{1,3}(?:[\\s\\u00a0\\u202f.,]\\d{3}(?!\\d))+(?:[.,]\\d{1,2}(?!\\d))?|\\d+(?:[.,]\\d+)?)";
const CUR = "\\s*F(?:\\s?CFA)?";

const OM_TRANSFER = new RegExp(
  `transfert\\s+de\\s+${NUM}${CUR}\\s+vers\\s+(?:le\\s+)?(.+?)\\s+est\\s+un\\s+succ[eè]s` +
    `.*?frais\\s*:?\\s*${NUM}${CUR}.*?solde\\s*:?\\s*${NUM}${CUR}`,
  "is"
);

const OM_PAYMENT = new RegExp(
  `montant\\s+paiement\\s+effectu[eé]\\s*:?\\s*${NUM}${CUR}` +
    `.*?frais\\s+OM\\s*:?\\s*${NUM}${CUR}.*?solde\\s*:?\\s*${NUM}${CUR}`,
  "is"
);

const WAVE_DEPOSIT = new RegExp(
  `${NUM}${CUR}\\s+transf[eé]r[eé]\\s+de\\s+votre\\s+compte\\s+(.+?)\\s+vers\\s+votre\\s+compte\\s+wave` +
    `\\s+frais\\s*:?\\s*${NUM}(?:${CUR})?(.*?)solde\\s+wave\\s*:?\\s*${NUM}${CUR}`,
  "is"
);

/**
 * Convertit un montant écrit à l'ivoirienne ou à l'européenne en FCFA entier.
 * "1.500" et "1,500" → 1500 (3 chiffres après l'unique séparateur = milliers),
 * "1.500,50" → 1501 (le dernier séparateur est la décimale), "12,5" → 13.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s  ]/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const lastSep = Math.max(lastDot, lastComma);
  let normalized: string;

  if (lastSep === -1) {
    normalized = s;
  } else if (lastDot !== -1 && lastComma !== -1) {
    normalized = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  } else {
    const sep = lastDot !== -1 ? "." : ",";
    const occurrences = s.split(sep).length - 1;
    const digitsAfter = s.length - lastSep - 1;
    normalized =
      occurrences > 1 || digitsAfter === 3
        ? s.split(sep).join("")
        : s.slice(0, lastSep) + "." + s.slice(lastSep + 1);
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Lit "12/03/2025 14:30[:05]", "12-03-25" ou "2025-03-12 14:30" dans un fragment de texte. */
function parseDate(fragment: string): string | undefined {
  let y: number, mo: number, d: number;
  let m = fragment.match(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/);
  if (m) {
    d = Number(m[1]);
    mo = Number(m[2]);
    y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  } else {
    m = fragment.match(/(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/);
    if (!m) return undefined;
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
  }
  const t = fragment.match(/(\d{1,2})[:h](\d{2})(?::(\d{2}))?/);
  const date = new Date(y, mo - 1, d, t ? Number(t[1]) : 0, t ? Number(t[2]) : 0, t?.[3] ? Number(t[3]) : 0);
  const valid = date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
  return valid ? date.toISOString() : undefined;
}

function toAmounts(...raw: string[]): number[] | null {
  const out = raw.map(parseAmount);
  return out.every((n): n is number => n !== null) ? out : null;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Analyse un SMS Orange Money / Wave. Retourne null si le format n'est pas reconnu. */
export function parseSms(text: string): ParsedSms | null {
  const raw = cleanText(text);

  let m = raw.match(OM_TRANSFER);
  if (m) {
    const nums = toAmounts(m[1], m[3], m[4]);
    if (!nums) return null;
    return {
      kind: "om_transfer",
      walletId: "orange",
      type: "expense",
      amount: nums[0],
      fee: nums[1],
      balance: nums[2],
      recipient: m[2].trim(),
      raw,
    };
  }

  m = raw.match(OM_PAYMENT);
  if (m) {
    const nums = toAmounts(m[1], m[2], m[3]);
    if (!nums) return null;
    return {
      kind: "om_payment",
      walletId: "orange",
      type: "expense",
      amount: nums[0],
      fee: nums[1],
      balance: nums[2],
      raw,
    };
  }

  m = raw.match(WAVE_DEPOSIT);
  if (m) {
    const nums = toAmounts(m[1], m[3], m[5]);
    if (!nums) return null;
    return {
      kind: "wave_deposit",
      walletId: "wave",
      type: "income",
      amount: nums[0],
      fee: nums[1],
      balance: nums[2],
      bank: m[2].trim(),
      date: parseDate(m[4]),
      raw,
    };
  }

  return null;
}

/** Analyse plusieurs SMS collés ensemble (séparés par une ligne vide). */
export function parseSmsBatch(text: string): { parsed: ParsedSms[]; unrecognized: string[] } {
  const chunks = text
    .split(/\n\s*\n/)
    .map(cleanText)
    .filter(Boolean);
  const parsed: ParsedSms[] = [];
  const unrecognized: string[] = [];
  for (const chunk of chunks) {
    const result = parseSms(chunk);
    if (result) parsed.push(result);
    else unrecognized.push(chunk);
  }
  return { parsed, unrecognized };
}

/** Clé stable pour repérer un SMS déjà importé. */
export function smsKey(sms: ParsedSms): string {
  let h = 5381;
  for (let i = 0; i < sms.raw.length; i++) h = ((h << 5) + h + sms.raw.charCodeAt(i)) | 0;
  return `sms-${(h >>> 0).toString(36)}-${sms.raw.length}`;
}
