import { partyKey } from "@/lib/smart-categorizer";
import type { Transaction } from "@/types/finance";

/* ------------------------------------------------------------------ Types */

export type DebtKind = "owed_to_me" | "i_owe";

export interface Debt {
  id: string;
  kind: DebtKind;
  person: string;
  phone?: string;
  amount: number;
  note?: string;
  createdAt: string;
  /** Soldée à la main (en plus du solde automatique par les paiements reçus ou envoyés). */
  settledAt?: string;
}

export interface TontineMember {
  id: string;
  name: string;
  phone: string;
}

export interface Tontine {
  id: string;
  name: string;
  /** Cotisation mensuelle par membre, en FCFA. */
  amount: number;
  members: TontineMember[];
  /** Cotisations cochées à la main : mois (AAAA-MM) → identifiants des membres. */
  paid: Record<string, string[]>;
}

export interface LifeEvent {
  id: string;
  name: string;
  /** AAAA-MM-JJ */
  date: string;
  target: number;
  saved: number;
}

export interface CieCalibration {
  /** Ce que le compteur affichait, en FCFA. */
  remaining: number;
  at: string;
}

export interface LifestyleData {
  debts: Debt[];
  tontines: Tontine[];
  events: LifeEvent[];
  cie: CieCalibration | null;
}

export const EMPTY_LIFESTYLE: LifestyleData = { debts: [], tontines: [], events: [], cie: null };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
const amountOf = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const validDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Remet à plat des données lues (stockage local ou Firestore) : jamais de valeur invalide. */
export function sanitizeLifestyle(raw: unknown): LifestyleData {
  const r = isObj(raw) ? raw : {};
  const list = (v: unknown) => (Array.isArray(v) ? v : []);

  const debts: Debt[] = [];
  for (const d of list(r.debts)) {
    if (!isObj(d) || typeof d.id !== "string" || !validDate(d.createdAt) || amountOf(d.amount) <= 0) continue;
    debts.push({
      id: d.id,
      kind: d.kind === "i_owe" ? "i_owe" : "owed_to_me",
      person: str(d.person, 60) || "Sans nom",
      ...(str(d.phone, 30) ? { phone: str(d.phone, 30) } : {}),
      amount: amountOf(d.amount),
      ...(str(d.note) ? { note: str(d.note) } : {}),
      createdAt: d.createdAt,
      ...(validDate(d.settledAt) ? { settledAt: d.settledAt } : {}),
    });
  }

  const tontines: Tontine[] = [];
  for (const t of list(r.tontines)) {
    if (!isObj(t) || typeof t.id !== "string") continue;
    const members: TontineMember[] = [];
    for (const m of list(t.members)) {
      if (isObj(m) && typeof m.id === "string") members.push({ id: m.id, name: str(m.name, 60) || "Membre", phone: str(m.phone, 30) });
    }
    const paid: Record<string, string[]> = {};
    if (isObj(t.paid)) {
      for (const [month, ids] of Object.entries(t.paid)) {
        if (/^\d{4}-\d{2}$/.test(month) && Array.isArray(ids)) paid[month] = ids.filter((i): i is string => typeof i === "string");
      }
    }
    tontines.push({ id: t.id, name: str(t.name, 60) || "Tontine", amount: amountOf(t.amount), members, paid });
  }

  const events: LifeEvent[] = [];
  for (const e of list(r.events)) {
    if (!isObj(e) || typeof e.id !== "string" || !validDate(e.date)) continue;
    events.push({ id: e.id, name: str(e.name, 60) || "Événement", date: e.date.slice(0, 10), target: amountOf(e.target), saved: amountOf(e.saved) });
  }

  const cie = isObj(r.cie) && validDate(r.cie.at) ? { remaining: amountOf(r.cie.remaining), at: r.cie.at } : null;
  return { debts, tontines, events, cie };
}

/* ------------------------------------------------------------------ CIE prépayé */

export const isCiePurchase = (t: Pick<Transaction, "type" | "title" | "party" | "note">) =>
  t.type === "expense" && /\bcie\b|pr[eé]pay[eé]e?\s*cie/i.test(`${t.title} ${t.party ?? ""} ${t.note ?? ""}`);

export type CieLevel = "unknown" | "ok" | "soon" | "urgent";

export interface CieForecast {
  purchases: number;
  lastAt: string | null;
  lastAmount: number | null;
  /** Consommation moyenne en FCFA par jour (déduite des recharges successives). */
  ratePerDay: number | null;
  /** Crédit restant estimé, en FCFA. */
  remaining: number | null;
  daysLeft: number | null;
  level: CieLevel;
}

const DAY = 86_400_000;

/**
 * Rythme de consommation : chaque recharge est consommée jusqu'à la suivante, donc montant ÷ jours écoulés.
 * On moyenne les 3 derniers intervalles. Le crédit restant part de la dernière recharge, ou du relevé du compteur
 * saisi par l'utilisateur s'il est plus récent.
 */
export function forecastCie(transactions: Transaction[], calibration: CieCalibration | null, now = Date.now()): CieForecast {
  const buys = transactions
    .filter(isCiePurchase)
    .map((t) => ({ amount: t.amount, at: Date.parse(t.date) }))
    .filter((b) => Number.isFinite(b.at))
    .sort((a, b) => a.at - b.at);

  const last = buys[buys.length - 1] ?? null;
  const rates: number[] = [];
  for (let i = 0; i < buys.length - 1; i++) {
    const days = (buys[i + 1].at - buys[i].at) / DAY;
    if (days >= 0.5) rates.push(buys[i].amount / days);
  }
  const recent = rates.slice(-3);
  const ratePerDay = recent.length > 0 ? recent.reduce((s, r) => s + r, 0) / recent.length : null;

  const base = (() => {
    if (calibration && (!last || Date.parse(calibration.at) >= last.at)) return { amount: calibration.remaining, at: Date.parse(calibration.at) };
    return last ? { amount: last.amount, at: last.at } : null;
  })();

  let remaining: number | null = null;
  let daysLeft: number | null = null;
  let level: CieLevel = "unknown";
  if (ratePerDay && base) {
    remaining = Math.max(0, Math.round(base.amount - ratePerDay * ((now - base.at) / DAY)));
    daysLeft = Math.floor(remaining / ratePerDay);
    level = daysLeft <= 2 ? "urgent" : daysLeft <= 5 ? "soon" : "ok";
  }
  return {
    purchases: buys.length,
    lastAt: last ? new Date(last.at).toISOString() : null,
    lastAmount: last?.amount ?? null,
    ratePerDay: ratePerDay ? Math.round(ratePerDay) : null,
    remaining,
    daysLeft,
    level,
  };
}

/* ------------------------------------------------------------------ Dettes */

/** Paiements qui soldent la dette : reçus du débiteur (il me doit) ou envoyés au créancier (je dois), depuis sa création. */
export function debtProgress(d: Debt, transactions: Transaction[]) {
  const key = partyKey(d.phone);
  let paid = 0;
  if (key) {
    const wanted = d.kind === "owed_to_me" ? "income" : "expense";
    const since = Date.parse(d.createdAt);
    for (const t of transactions) {
      if (t.type === wanted && partyKey(t.party) === key && Date.parse(t.date) >= since) paid += t.amount;
    }
  }
  const remaining = Math.max(0, d.amount - paid);
  return { paid, remaining, settled: Boolean(d.settledAt) || remaining === 0 };
}

/** Numéro ivoirien au format international pour wa.me (10 chiffres → 225 + numéro). */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `225${digits}`;
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

export function debtReminderMessage(d: Debt, remaining: number): string {
  const first = d.person.split(" ")[0];
  const amount = new Intl.NumberFormat("fr-FR").format(remaining);
  return d.kind === "owed_to_me"
    ? `Bonjour ${first}, j'espère que tu vas bien 🙏 Je me permets de te rappeler gentiment les ${amount} FCFA${d.note ? ` (${d.note})` : ""}. Dès que possible, tu peux me les envoyer par Wave ou Orange Money. Merci beaucoup !`
    : `Bonjour ${first}, j'espère que tu vas bien 🙏 Je pense à mes ${amount} FCFA${d.note ? ` (${d.note})` : ""} : je te les envoie très bientôt. Merci pour ta patience !`;
}

export const whatsappLink = (phone: string | undefined, text: string) =>
  `https://wa.me/${phone ? whatsappNumber(phone) : ""}?text=${encodeURIComponent(text)}`;

/* ------------------------------------------------------------------ Tontine */

export const monthKey = (d: Date | string) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

/** Un membre a payé ce mois-ci : transfert reçu depuis son numéro, ou case cochée à la main. */
export function tontineMemberStatus(t: Tontine, m: TontineMember, month: string, transactions: Transaction[]) {
  const key = partyKey(m.phone);
  const auto =
    key !== null &&
    transactions.some((tx) => tx.type === "income" && monthKey(tx.date) === month && partyKey(tx.party) === key);
  const manual = (t.paid[month] ?? []).includes(m.id);
  return { paid: auto || manual, auto };
}

export function tontineSummary(t: Tontine, month: string, transactions: Transaction[]): string {
  const [y, m] = month.split("-").map(Number);
  const title = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const rows = t.members.map((member) => ({ member, ...tontineMemberStatus(t, member, month, transactions) }));
  const paid = rows.filter((r) => r.paid);
  const waiting = rows.filter((r) => !r.paid);
  const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;
  return [
    `*${t.name}* — cotisations de ${title}`,
    `Cotisation : ${fmt(t.amount)} par personne`,
    "",
    `✅ Payé (${paid.length}/${rows.length}) : ${paid.map((r) => r.member.name).join(", ") || "personne pour l'instant"}`,
    `⏳ En attente (${waiting.length}) : ${waiting.map((r) => r.member.name).join(", ") || "personne, bravo à tous !"}`,
    "",
    `Collecté : ${fmt(paid.length * t.amount)} sur ${fmt(rows.length * t.amount)}`,
  ].join("\n");
}

/* ------------------------------------------------------------------ Événements */

/** Dates indicatives des fêtes mobiles (calendrier lunaire pour Korité et Tabaski) : à corriger selon l'annonce officielle. */
const ISLAMIC: Record<string, Record<number, string>> = {
  Korité: { 2026: "2026-03-20", 2027: "2027-03-10", 2028: "2028-02-27", 2029: "2029-02-15" },
  Tabaski: { 2026: "2026-05-27", 2027: "2027-05-17", 2028: "2028-05-06", 2029: "2029-04-26" },
  Pâques: { 2026: "2026-04-05", 2027: "2027-03-28", 2028: "2028-04-16", 2029: "2029-04-01" },
};

export function eventPresets(now = new Date()): { name: string; date: string }[] {
  const upcoming = (iso: string) => Date.parse(iso) > now.getTime();
  const y = now.getFullYear();
  const fixed = (month: number, day: number) => {
    const this_ = new Date(y, month - 1, day);
    return (this_.getTime() > now.getTime() ? this_ : new Date(y + 1, month - 1, day)).toISOString().slice(0, 10);
  };
  const next = (name: string) => {
    const dates = Object.values(ISLAMIC[name]).sort();
    return dates.find(upcoming) ?? dates[dates.length - 1];
  };
  return [
    { name: "Rentrée scolaire", date: fixed(9, 7) },
    { name: "Tabaski", date: next("Tabaski") },
    { name: "Korité", date: next("Korité") },
    { name: "Pâques", date: next("Pâques") },
    { name: "Noël", date: fixed(12, 25) },
  ];
}

export function monthsUntil(date: string, now = new Date()): number {
  const target = new Date(date);
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()) + (target.getDate() >= now.getDate() ? 0 : -1);
  return Math.max(1, months);
}

export const monthlyNeeded = (e: LifeEvent, now = new Date()) =>
  Math.max(0, Math.ceil((e.target - e.saved) / monthsUntil(e.date, now) / 100) * 100);

/* ------------------------------------------------------------------ Dictée d'une dépense */

const UNITS: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40,
  cinquante: 50, soixante: 60,
};
const CURRENCY = new Set(["franc", "francs", "f", "fcfa", "cfa", "xof"]);
const STOP = new Set(["et", "de", "d", "du", "des", "le", "la", "les", "un", "une", "j'ai", "jai", "pris", "payé", "paye", "acheté", "achete", "pour", "avec", "ensuite", "puis", "aussi", "a", "à", "au", "en", "dépensé", "depense"]);

export interface SpokenExpense {
  label: string;
  amount: number;
}

const norm = (w: string) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** « Gbaka 300 francs et garba 1000 francs » → [{gbaka, 300}, {garba, 1000}] (chiffres ou mots : « mille », « deux cents »…). */
export function parseSpokenExpenses(text: string): SpokenExpense[] {
  const tokens = (text.replace(/(\d)[\s.,](\d{3})(?!\d)/g, "$1$2").toLowerCase().match(/\d+(?:[.,]\d+)?|[a-zà-ÿœ'’-]+/g) ?? []).flatMap((t) =>
    /^[a-zà-ÿœ'’-]+$/.test(t) && t.includes("-") && Object.keys(UNITS).some((u) => t.startsWith(u)) ? t.split("-") : [t]
  );

  const items: SpokenExpense[] = [];
  let pending: string[] = [];
  let awaiting: SpokenExpense | null = null;

  const isNumberWord = (w: string) => norm(w) in UNITS || ["cent", "cents", "mille", "milles"].includes(norm(w));

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    let amount: number | null = null;

    if (/^\d/.test(tok)) {
      amount = Math.round(Number(tok.replace(",", ".")));
      // « 2 mille » = 2000
      if (norm(tokens[i + 1] ?? "") === "mille") {
        amount *= 1000;
        i++;
      }
    } else if (isNumberWord(tok)) {
      let total = 0;
      let current = 0;
      let j = i;
      for (; j < tokens.length; j++) {
        const w = norm(tokens[j]);
        if (w === "et" && isNumberWord(tokens[j + 1] ?? "")) continue;
        if (w === "mille" || w === "milles") {
          total += (current || 1) * 1000;
          current = 0;
        } else if (w === "cent" || w === "cents") {
          current = (current || 1) * 100;
        } else if (w === "vingt" && current === 4) {
          current = 80;
        } else if (w in UNITS) {
          current += UNITS[w];
        } else break;
      }
      amount = total + current;
      i = j - 1;
    }

    if (amount !== null && amount > 0) {
      while (CURRENCY.has(norm(tokens[i + 1] ?? ""))) i++;
      const label = pending.join(" ").trim();
      if (label) {
        items.push({ label, amount });
        pending = [];
        awaiting = null;
      } else {
        awaiting = { label: "", amount };
        items.push(awaiting);
      }
    } else if (!STOP.has(tok) && !CURRENCY.has(norm(tok))) {
      if (awaiting && !awaiting.label) {
        awaiting.label = tok;
        // le reste du libellé (« poulet braisé ») jusqu'au prochain montant
        while (i + 1 < tokens.length && !/^\d/.test(tokens[i + 1]) && !isNumberWord(tokens[i + 1]) && !STOP.has(tokens[i + 1])) {
          awaiting.label += ` ${tokens[++i]}`;
        }
        awaiting = null;
      } else {
        pending.push(tok);
      }
    }
  }
  return items.map((it) => ({ ...it, label: (it.label || "Dépense").replace(/^./, (c) => c.toUpperCase()) }));
}

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
