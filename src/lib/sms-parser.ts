import type { ExpenseSubtype, TransactionType, WalletId } from "@/types/finance";

export type SmsKind =
  | "om_transfer"
  | "om_payment"
  | "wave_deposit"
  | "wave_payment"
  | "wave_send"
  | "wave_receive"
  | "wave_receipt"
  | "generic_debit"
  | "generic_credit";

export interface ParsedSms {
  kind: SmsKind;
  walletId: WalletId;
  /** Vrai quand le portefeuille a été deviné (le texte ne le dit pas clairement) : à confirmer. */
  walletGuessed?: boolean;
  type: TransactionType;
  amount: number;
  fee: number;
  /** Solde du portefeuille après l'opération, tel qu'annoncé par l'opérateur (null si le reçu n'en donne pas). */
  balance: number | null;
  /** Destinataire (transfert Orange Money ou Wave). */
  recipient?: string;
  /** Expéditeur (argent reçu sur Wave). */
  sender?: string;
  /** Marchand (paiement Wave ou Orange Money). */
  merchant?: string;
  /** Identifiant de transaction lu sur le reçu, quand il existe. */
  txId?: string;
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

// Reçus Wave : "Paiement de 2 500F à CHEZ AMINATA", "Vous avez envoyé 5000F à X (+225…)",
// "Vous avez reçu 5000F de X". Les frais, le solde et l'ID sont lus à part (voir extractTail).
const WAVE_PAYMENT = new RegExp(
  `(?:paiement\\s+(?:marchand\\s+)?(?:de|d['’])\\s*|vous\\s+avez\\s+pay[eé]\\s+)${NUM}${CUR}\\s+(?:[aà]|chez|au)\\s+(.+?)` +
    `(?=\\s*[.,;(]|\\s+effectu|\\s+avec\\s+succ|\\s+frais|\\s+solde|\\s+nouveau|\\s+id\\b|\\s+le\\s+\\d|$)`,
  "i"
);

const WAVE_SEND = new RegExp(
  `vous\\s+avez\\s+envoy[eé]\\s+${NUM}${CUR}\\s+(?:[aà])\\s+(.+?)` +
    `(?=\\s*[.;]|\\s+effectu|\\s+avec\\s+succ|\\s+frais|\\s+solde|\\s+nouveau|\\s+id\\b|\\s+le\\s+\\d|$)`,
  "i"
);

const WAVE_RECEIVE = new RegExp(
  `vous\\s+avez\\s+re[cç]u\\s+${NUM}${CUR}\\s+de\\s+(.+?)` +
    `(?=\\s*[.;]|\\s+effectu|\\s+avec\\s+succ|\\s+frais|\\s+solde|\\s+nouveau|\\s+id\\b|\\s+le\\s+\\d|$)`,
  "i"
);

// Reçu Wave multi-lignes : « Type de transaction: Paiement / Marchand: X / Montant: 750F / Frais: 0F / ID de transaction: T_… ».
const WAVE_RECEIPT = new RegExp(
  `type\\s+de\\s+transaction\\s*:\\s*([^:]+?)\\s+(?:marchand|merchant|b[eé]n[eé]ficiaire|destinataire|exp[eé]diteur|de|[aà])\\s*:\\s*(.+?)\\s+montant\\s*:?\\s*${NUM}${CUR}`,
  "i"
);
const WAVE_RECEIPT_INCOME = /d[eé]p[oô]t|re[cç]u|r[eé]ception|encaiss/i;

// Notifications génériques : « Votre compte a été débité de 5 000 FCFA », « crédité de … ».
const GENERIC_DEBIT = new RegExp(`(?:d[eé]bit[eé]|pr[eé]lev[eé]|d[eé]bit)\\s+(?:de\\s+)?${NUM}${CUR}`, "i");
const GENERIC_CREDIT = new RegExp(`(?:cr[eé]dit[eé]|re[cç]u|approvisionn[eé])\\s+(?:de\\s+)?${NUM}${CUR}`, "i");

// Mots-clés d'un SMS générique (MTN, Moov, Djamo…) quand le format n'est pas celui d'Orange Money ou de Wave.
const KW_DEBIT = new RegExp(
  `(?:retrait|envoy[eé]|transfert|paiement|pay[eé]|achat)(?=[\\s:,])(?:[^.]*?\\b(?:montant|de)\\s*:?\\s*|[^.]*?\\s)${NUM}${CUR}`,
  "i"
);
const KW_CREDIT = new RegExp(
  `(?:d[eé]p[oô]t|re[cç]u|r[eé]ception)(?=[\\s:,])(?:[^.]*?\\b(?:montant|de)\\s*:?\\s*|[^.]*?\\s)${NUM}${CUR}|${NUM}${CUR}\\s+transf[eé]r[eé]\\s+de\\s+.+?\\s+vers\\s+votre\\s+compte`,
  "i"
);

const FEE_RE = new RegExp(`frais(?:\\s+(?:OM|wave|de\\s+transaction))?\\s*:?\\s*${NUM}(?:${CUR})?`, "i");
const BALANCE_RE = new RegExp(`(?:nouveau\\s+)?solde(?:\\s+(?:wave|om|orange\\s+money))?\\s*:?\\s*${NUM}${CUR}`, "i");
const TXID_RE =
  /(?:id(?:\s+de)?(?:\s+(?:la\s+)?transaction)?|transaction\s+id|r[eé]f(?:[eé]rence)?|txn)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9_.-]{5,})/i;
const MERCHANT_RE =
  /(?:marchand|merchant|b[eé]n[eé]ficiaire|chez)\s*:?\s*([^.;]+?)(?=\s*[.;]|\s+frais|\s+solde|\s+nouveau|\s+id\b|$)/i;

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
  return (
    text
      .replace(/\s+/g, " ")
      // Wave écrit parfois « Frais: OF » : la lettre O à la place du chiffre 0.
      .replace(/(frais\s*:?\s*)[Oo](?=\s*F\b)/gi, "$10")
      .trim()
  );
}

/** Retire la ponctuation de fin de phrase accolée à un identifiant ("…A12345."). */
function cleanId(id: string | undefined): string | undefined {
  return id?.replace(/[.\-_]+$/g, "") || undefined;
}

/** Devine le portefeuille d'après les mots du texte ; `guessed` vrai quand rien ne l'indique. */
function guessWallet(raw: string, fallback: WalletId): { walletId: WalletId; guessed: boolean } {
  if (/\bwave\b/i.test(raw)) return { walletId: "wave", guessed: false };
  if (/orange|\bOM\b/i.test(raw)) return { walletId: "orange", guessed: false };
  if (/\bmtn\b|momo/i.test(raw)) return { walletId: "mtn", guessed: false };
  if (/\bmoov\b/i.test(raw)) return { walletId: "moov", guessed: false };
  if (/djamo/i.test(raw)) return { walletId: "djamo", guessed: false };
  return { walletId: fallback, guessed: true };
}

// Ces formats viennent de Wave : sans autre indication, c'est Wave (pas besoin de confirmation).
function walletFields(raw: string): { walletId: WalletId } {
  return { walletId: guessWallet(raw, "wave").walletId };
}

/** Nettoie un nom/numéro capturé : retire parenthèses vides, ponctuation de fin et espaces. */
function cleanParty(value: string): string {
  return value.replace(/[\s.,;:]+$/g, "").trim();
}

/** Frais, solde, identifiant de transaction et date, communs aux reçus Wave / Orange Money. */
function extractTail(raw: string): { fee: number; balance: number | null; txId?: string; date?: string } {
  const feeMatch = raw.match(FEE_RE);
  const balMatch = raw.match(BALANCE_RE);
  const fee = feeMatch ? parseAmount(feeMatch[1]) : 0;
  const balance = balMatch ? parseAmount(balMatch[1]) : null;
  const txId = cleanId(raw.match(TXID_RE)?.[1]);
  return { fee: fee ?? 0, balance, txId, date: parseDate(raw) };
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
      recipient: cleanParty(m[2]),
      txId: cleanId(raw.match(TXID_RE)?.[1]),
      date: parseDate(raw),
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
      merchant: raw.match(MERCHANT_RE)?.[1] ? cleanParty(raw.match(MERCHANT_RE)![1]) : undefined,
      txId: cleanId(raw.match(TXID_RE)?.[1]),
      date: parseDate(raw),
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

  m = raw.match(WAVE_RECEIPT);
  if (m) {
    const amount = parseAmount(m[3]);
    if (amount === null) return null;
    const tail = extractTail(raw);
    const income = WAVE_RECEIPT_INCOME.test(m[1]);
    return {
      kind: "wave_receipt",
      ...walletFields(raw),
      type: income ? "income" : "expense",
      amount,
      fee: tail.fee,
      balance: tail.balance,
      ...(income ? { sender: cleanParty(m[2]) } : { merchant: cleanParty(m[2]) }),
      txId: tail.txId,
      date: tail.date,
      raw,
    };
  }

  m = raw.match(WAVE_PAYMENT);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount === null) return null;
    const tail = extractTail(raw);
    return {
      kind: "wave_payment",
      ...walletFields(raw),
      type: "expense",
      amount,
      fee: tail.fee,
      balance: tail.balance,
      merchant: cleanParty(m[2]),
      txId: tail.txId,
      date: tail.date,
      raw,
    };
  }

  m = raw.match(WAVE_SEND);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount === null) return null;
    const tail = extractTail(raw);
    return {
      kind: "wave_send",
      ...walletFields(raw),
      type: "expense",
      amount,
      fee: tail.fee,
      balance: tail.balance,
      recipient: cleanParty(m[2]),
      txId: tail.txId,
      date: tail.date,
      raw,
    };
  }

  m = raw.match(WAVE_RECEIVE);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount === null) return null;
    const tail = extractTail(raw);
    return {
      kind: "wave_receive",
      ...walletFields(raw),
      type: "income",
      amount,
      fee: tail.fee,
      balance: tail.balance,
      sender: cleanParty(m[2]),
      txId: tail.txId,
      date: tail.date,
      raw,
    };
  }

  m = raw.match(GENERIC_DEBIT);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount === null || amount <= 0) return null;
    const tail = extractTail(raw);
    const w = guessWallet(raw, "wave");
    return {
      kind: "generic_debit",
      walletId: w.walletId,
      ...(w.guessed ? { walletGuessed: true } : {}),
      type: "expense",
      amount,
      fee: tail.fee,
      balance: tail.balance,
      merchant: raw.match(MERCHANT_RE)?.[1] ? cleanParty(raw.match(MERCHANT_RE)![1]) : undefined,
      txId: tail.txId,
      date: tail.date,
      raw,
    };
  }

  m = raw.match(GENERIC_CREDIT);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount === null || amount <= 0) return null;
    const tail = extractTail(raw);
    const w = guessWallet(raw, "wave");
    return {
      kind: "generic_credit",
      walletId: w.walletId,
      ...(w.guessed ? { walletGuessed: true } : {}),
      type: "income",
      amount,
      fee: tail.fee,
      balance: tail.balance,
      txId: tail.txId,
      date: tail.date,
      raw,
    };
  }

  // Mots-clés génériques : retrait / envoyé à / transfert de / paiement → dépense ; dépôt / reçu / transféré vers votre compte → entrée.
  m = raw.match(KW_DEBIT);
  if (m) {
    const amount = parseAmount(m[1]);
    if (amount === null || amount <= 0) return null;
    const tail = extractTail(raw);
    const w = guessWallet(raw, "wave");
    return {
      kind: "generic_debit",
      walletId: w.walletId,
      ...(w.guessed ? { walletGuessed: true } : {}),
      type: "expense",
      amount,
      fee: tail.fee,
      balance: tail.balance,
      txId: tail.txId,
      date: tail.date,
      raw,
    };
  }

  m = raw.match(KW_CREDIT);
  if (m) {
    const amount = parseAmount(m[1] ?? m[2]);
    if (amount === null || amount <= 0) return null;
    const tail = extractTail(raw);
    const w = guessWallet(raw, "wave");
    return {
      kind: "generic_credit",
      walletId: w.walletId,
      ...(w.guessed ? { walletGuessed: true } : {}),
      type: "income",
      amount,
      fee: tail.fee,
      balance: tail.balance,
      txId: tail.txId,
      date: tail.date,
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

/** Transfert, retrait ou paiement : le compartiment de dépense d'un SMS (undefined pour une entrée). */
export function smsSubtype(sms: ParsedSms): ExpenseSubtype | undefined {
  if (sms.type !== "expense") return undefined;
  switch (sms.kind) {
    case "om_transfer":
    case "wave_send":
      return "transfert";
    case "om_payment":
    case "wave_payment":
      return "paiement";
    default:
      if (/retrait/i.test(sms.raw)) return "retrait";
      if (/paiement|pay[eé]|achat|marchand/i.test(sms.raw) || sms.merchant) return "paiement";
      return "transfert";
  }
}

/** Clé stable pour repérer un SMS déjà importé. */
export function smsKey(sms: ParsedSms): string {
  if (sms.txId) return `sms-tx-${sms.walletId}-${sms.txId}`;
  let h = 5381;
  for (let i = 0; i < sms.raw.length; i++) h = ((h << 5) + h + sms.raw.charCodeAt(i)) | 0;
  return `sms-${(h >>> 0).toString(36)}-${sms.raw.length}`;
}
