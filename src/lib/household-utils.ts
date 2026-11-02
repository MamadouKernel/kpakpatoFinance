import type { Gender, HouseholdMember } from "@/types/finance";

const digits = (value: string) => value.replace(/\D/g, "");

const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

  const alias = partner.alias ? normalizeName(partner.alias) : "";
  if (alias.length >= 3) {
    const name = normalizeName(party);
    // Les mots du nom peuvent être dans un autre ordre ("KONATE AMINATA" / "Aminata Konate").
    const words = alias.split(" ").filter((w) => w.length > 1);
    if (name.includes(alias) || (words.length > 0 && words.every((w) => name.includes(w)))) return true;
  }

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
