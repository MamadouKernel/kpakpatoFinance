import { INTERNAL_CATEGORY } from "@/lib/finance-utils";
import type { TransactionCategory } from "@/types/finance";

/** Services et commerces de Côte d'Ivoire reconnus par mots-clés. L'ordre compte : la première règle qui correspond gagne. */
const KEYWORD_RULES: { category: TransactionCategory; pattern: RegExp }[] = [
  // « Yango Deli » est de la livraison de repas : avant la règle Yango (transport).
  { category: "Nourriture & Garba", pattern: /yango\s*deli|\bglovo\b|kiosque|boulangerie|prosuma|carrefour|cap\s*sud|supermarch|maquis|garba|alloco|att?i[eé]k[eé]|poisson|poulet|brais[eé]|viande|riz\b|pain\b|march[eé]\b/i },
  { category: "Transport (Yango/Gbaka/Wôrô)", pattern: /\byango\b|\bheetch\b|\buber\b|sotra|p[eé]age|gbaka|w[oô]r[oô]|taxi|moto\s*taxi|bus\b/i },
  {
    category: "Loyer & Factures (CIE/SODECI)",
    pattern: /\bcie\b|pr[eé]pay[eé]e?\s*cie|sodeci|canal\s*\+|canal\s*plus|canalbox|fibre\s*orange|orange\s*fibre|mtn\s*home|moov\s*fibre|loyer/i,
  },
];

/** Catégorie déduite de mots-clés dans l'un des textes (marchand, destinataire, libellé…), sinon null. */
export function categorizeByKeywords(...texts: (string | undefined)[]): TransactionCategory | null {
  const text = texts.filter(Boolean).join(" ");
  if (!text) return null;
  return KEYWORD_RULES.find((r) => r.pattern.test(text))?.category ?? null;
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

/**
 * Clé stable d'un numéro ou d'un marchand, utilisable comme nom de champ Firestore.
 * Les numéros se comparent sur leurs 8 derniers chiffres (« 07 59 30 31 30 » = « +225 0759303130 »).
 */
export function partyKey(party: string | undefined): string | null {
  if (!party) return null;
  const digits = digitsOf(party);
  if (digits.length >= 8) return `tel-${digits.slice(-8)}`;
  const slug = party
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length >= 3 ? `nom-${slug.slice(0, 60)}` : null;
}

/** « 0759303130 » → « 07 59 30 31 30 » ; un nom reste tel quel. */
export function displayParty(party: string): string {
  const digits = digitsOf(party);
  if (digits.length >= 10 && digits.length === party.replace(/[\s+().-]/g, "").length) {
    return digits.slice(-10).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  }
  return party;
}

export type ContactCategory = TransactionCategory | "partner";

export interface ContactMemory {
  category: ContactCategory;
  label: string;
  at: string;
}

/** Réponses proposées la première fois qu'un numéro ou un marchand apparaît. */
export const CONTACT_CHOICES: { label: string; category: ContactCategory }[] = [
  { label: "🍔 Repas", category: "Nourriture & Garba" },
  { label: "🚕 Transport", category: "Transport (Yango/Gbaka/Wôrô)" },
  { label: "🏠 Loyer / Facture", category: "Loyer & Factures (CIE/SODECI)" },
  { label: "👨‍👩‍👧 Famille / Tontine", category: "Famille & Tontine" },
  { label: "💑 Conjoint(e)", category: "partner" },
];

/** Catégorie à appliquer pour une réponse mémorisée (le conjoint = virement interne). */
export const categoryForContact = (c: ContactCategory): TransactionCategory =>
  c === "partner" ? INTERNAL_CATEGORY : c;
