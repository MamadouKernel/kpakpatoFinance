import type { Gender, HouseholdMember } from "@/types/finance";

const digits = (value: string) => value.replace(/\D/g, "");

// Mots d'état civil qui ne font pas partie du nom ("TRAORE ZEINAB épouse KONATE", "Mme …").
const NOISE_WORDS = new Set(["epouse", "ep", "epse", "nee", "mme", "mlle", "madame", "mademoiselle", "mr", "monsieur", "dame"]);

/** Ramène un mot à une forme phonétique simple : "Zeinab", "Zeynab" et "Zainab" donnent la même chose. */
function phonetic(word: string): string {
  return word
    .replace(/y/g, "i")
    .replace(/(ei|ai|ey|ay)/g, "i")
    .replace(/ou/g, "u")
    .replace(/ph/g, "f")
    .replace(/(.)\1+/g, "$1"); // lettres doublées : "Konatte" → "Konate"
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameWords(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((w) => w.length > 1 && !NOISE_WORDS.has(w))
    .map(phonetic);
}

/** Distance d'édition entre deux mots (insertion, suppression, remplacement). */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Deux mots désignent le même nom : identiques, ou à une faute de frappe près (mots de 5 lettres et plus). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 5 && editDistance(a, b) <= 1;
}

/**
 * Le nom saisi correspond au nom du SMS : ordre nom/prénom indifférent, majuscules, accents
 * et variantes d'orthographe tolérés. Plusieurs noms possibles, séparés par « ; ».
 */
function matchesName(party: string, aliasList: string): boolean {
  const partyWords = nameWords(party);
  return aliasList
    .split(/[;|]/)
    .map(nameWords)
    .filter((words) => words.length > 0)
    .some((words) => words.every((w) => partyWords.some((p) => sameWord(w, p))));
}

/**
 * Vrai si la contrepartie d'un SMS (numéro et/ou nom) correspond au conjoint.
 * Les numéros ivoiriens se comparent sur leurs 8 derniers chiffres (indicatif +225 ou 0 ignoré).
 */
export function isPartnerParty(party: string | undefined, partner: HouseholdMember | null | undefined): boolean {
  if (!party || !partner) return false;

  const phone = partner.phone ? digits(partner.phone) : "";
  if (phone.length >= 8) {
    const tail = phone.slice(-8);
    const partyDigits = digits(party);
    if (partyDigits.length >= 8 && partyDigits.endsWith(tail)) return true;
  }

  if (partner.alias && matchesName(party, partner.alias)) return true;

  return false;
}

/** Code d'invitation lisible (sans 0/O/1/I), à saisir par le conjoint. */
export function generateInviteCode(length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export const GENDER_LABELS: Record<Gender, string> = {
  femme: "Femme",
  homme: "Homme",
  autre: "Autre",
};

/** Mot employé pour désigner l'autre membre du couple, selon son genre. */
export function partnerWord(gender: Gender | undefined): string {
  if (gender === "homme") return "conjoint";
  if (gender === "femme") return "conjointe";
  if (gender === "autre") return "partenaire";
  return "conjoint(e)";
}

/** "Femme", "Homme" ou "Autre (précision)". */
export function describeGender(gender: Gender | undefined, other?: string): string {
  if (!gender) return "";
  return gender === "autre" && other ? `Autre (${other})` : GENDER_LABELS[gender];
}
