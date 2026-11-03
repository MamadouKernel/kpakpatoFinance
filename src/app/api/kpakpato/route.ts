import { NextRequest, NextResponse } from "next/server";
import { type CoachTone, localKpakpatoEngine } from "@/lib/coach-engine";
import { EMPTY_SNAPSHOT, type FinanceSnapshot } from "@/lib/coach-snapshot";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `Tu es "Kpakpato", le conseiller financier personnel intelligent des jeunes travailleurs, freelances et étudiants à Abidjan (Côte d'Ivoire).
Tes règles d'or :
1. Toutes les sommes sont exprimées en FCFA. Appuie-toi UNIQUEMENT sur les chiffres du contexte fourni : n'invente aucun montant.
2. Analyse la répartition entre les portefeuilles (Wave, Orange Money, MTN MoMo, Moov Money, Djamo, Cash) : conseille de ne pas laisser toute l'épargne sur Wave et d'isoler 15 à 20 % dans le coffre Djamo.
3. Loyer à Abidjan : loyer + transport ne doivent pas étouffer le salaire net (loyer ≤ 30 % du net FIXE).
4. Éduque sur le passage Salaire Brut -> Net en Côte d'Ivoire (CNPS 6,3 %, CMU 1 000 FCFA, ITS), la CIE prépayée, la SODECI, les tontines et la « taxe familiale ».
5. Réponds de façon structurée, concise (moins de 180 mots) et actionnable, avec des puces claires.
6. Salaire variable : base les charges fixes sur le salaire NET FIXE, jamais sur les heures supplémentaires. Mets 70 % de la prime nette d'heures sup en épargne et garde 30 % pour le plaisir et les paniers repas.`;

const TONE_RULES: Record<CoachTone, string> = {
  pro: "Ton : conseiller professionnel, clair et courtois, sans argot.",
  nouchi:
    "Ton : grand frère d'Abidjan bienveillant. Français ivoirien familier avec quelques expressions nouchi courantes et inoffensives (« mon gars », « on est ensemble », « c'est chaud », « gbê »), humour chaleureux, jamais vulgaire ni moqueur. Conseils précis et chiffrés, phrases courtes, 1 ou 2 emojis au plus : le message doit pouvoir être partagé tel quel sur WhatsApp.",
};

/**
 * Modèles essayés dans l'ordre. Les anciens (gemini-2.0-flash, gemini-2.5-flash) répondent « plus disponible » (404),
 * et les plus récents sont souvent saturés (503) : on commence par le plus rapide et on descend la liste.
 * GEMINI_MODEL, s'il est défini, passe en premier.
 */
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
const RACE_TIMEOUT_MS = 9000;
const LAST_TIMEOUT_MS = 5000;

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} FCFA`;

function contextText(s: FinanceSnapshot): string {
  const lines = [
    `Portefeuilles : ${s.wallets.map((w) => `${w.name} ${fcfa(w.balance)}`).join(", ") || "aucun"} (total ${fcfa(s.total)})`,
    `Ce mois : entrées ${fcfa(s.month.income)}, dépenses ${fcfa(s.month.expense)}`,
    s.month.byCategory.length ? `Dépenses par catégorie : ${s.month.byCategory.map((c) => `${c.category} ${fcfa(c.amount)}`).join(" ; ")}` : "",
    `Frais Mobile Money payés ce mois : ${fcfa(s.month.fees)}`,
    `Transport ce mois : ${fcfa(s.month.transport)} (dont Yango/VTC ${fcfa(s.month.transportYango)})`,
    `Restauration ce mois : ${fcfa(s.month.food)} (dont fast-food et livraisons ${fcfa(s.month.fastFood)})`,
    `Dépenses en espèces ce mois : ${fcfa(s.cashSpent)}`,
    s.salary
      ? `Salaire net fixe ${fcfa(s.salary.fixedNet)} ; loyer maximum conseillé (30 %) ${fcfa(s.salary.rentCap)} ; prime nette d'heures sup ${fcfa(s.salary.overtimeNetGain)} (${s.salary.overtimeHours} h)`
      : "Salaire non renseigné.",
    `Dettes : on me doit ${fcfa(s.debts.owedToMe)} ; je dois ${fcfa(s.debts.iOwe)}`,
    s.cie && s.cie.daysLeft !== null ? `Compteur CIE : environ ${s.cie.daysLeft} jour(s) restants (${fcfa(s.cie.ratePerDay ?? 0)} par jour)` : "",
    s.tontine.pendingMembers > 0 ? `Tontine : ${s.tontine.pendingMembers} cotisation(s) en attente (${s.tontine.groups.join(", ")})` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

async function askGemini(apiKey: string, model: string, system: string, prompt: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`Gemini ${model} : HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim();
    return text || null;
  } catch (err) {
    console.warn(`Gemini ${model} : ${err instanceof Error ? err.name : "erreur"}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  let message = "Analyse mes finances et donne-moi 3 conseils concrets.";
  let snapshot: FinanceSnapshot = EMPTY_SNAPSHOT;
  let tone: CoachTone = "pro";

  try {
    const body = await req.json();
    if (typeof body.message === "string" && body.message.trim()) message = body.message.trim().slice(0, 1000);
    if (body.snapshot && typeof body.snapshot === "object") snapshot = { ...EMPTY_SNAPSHOT, ...body.snapshot };
    if (body.tone === "nouchi") tone = "nouchi";
  } catch {
    // corps illisible : on répond quand même avec le moteur local
  }

  // Le moteur local répond toujours : sans clé, sans réseau ou si tous les modèles sont indisponibles.
  const local = () => NextResponse.json({ reply: localKpakpatoEngine(message, snapshot, tone), mode: "local-engine" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key") return local();

  const system = `${SYSTEM_PROMPT}\n7. ${TONE_RULES[tone]}`;
  const prompt = `Contexte financier réel de l'utilisateur (FCFA) :\n${contextText(snapshot)}\n\nQuestion : ${message}`;

  const custom = process.env.GEMINI_MODEL?.trim();
  const models = Array.from(new Set([...(custom ? [custom] : []), ...MODELS]));
  // Les deux premiers modèles partent en même temps : la première réponse valide gagne (moins d'attente si l'un est saturé).
  const race = models.slice(0, 2).map(async (model) => {
    const reply = await askGemini(apiKey, model, system, prompt, RACE_TIMEOUT_MS);
    if (!reply) throw new Error("vide");
    return { reply, model };
  });
  try {
    const winner = await Promise.any(race);
    return NextResponse.json({ reply: winner.reply, mode: "gemini-live", model: winner.model });
  } catch {
    // aucun des deux n'a répondu : on tente le modèle suivant avant de passer au moteur local
  }
  for (const model of models.slice(2, 3)) {
    const reply = await askGemini(apiKey, model, system, prompt, LAST_TIMEOUT_MS);
    if (reply) return NextResponse.json({ reply, mode: "gemini-live", model });
  }
  return local();
}
