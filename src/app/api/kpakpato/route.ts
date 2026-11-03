import { NextRequest, NextResponse } from "next/server";
import { Transaction, WalletInfo } from "@/types/finance";
import { formatFCFA, isInternalTransfer } from "@/lib/finance-utils";

const SYSTEM_PROMPT = `Tu es "Kpakpato", le conseiller financier personnel intelligent des jeunes travailleurs, freelances et étudiants à Abidjan (Côte d'Ivoire).
Ton ton est chaleureux, direct, bienveillant, légèrement teinté d'expressions ivoiriennes respectueuses ("Mon/Ma champion(ne)", "On se dit les gbê", "Faut pas que le mois finisse avant ton salaire", "Attention aux petits Yango et garba cumulés", "Coffre Djamo", "Tontine").
Tes règles d'or :
1. Toutes les sommes sont exprimées en FCFA.
2. Analyse concrètement la répartition entre les portefeuilles (Wave, Orange Money, MTN MoMo, Moov Money, Djamo, Cash) : conseille de ne pas laisser toute son épargne sur le compte Wave courant (tentation de dépense rapide) et d'isoler au moins 15-20% dans un Coffre Djamo ou compte épargne.
3. Rappelle la règle du loyer à Abidjan : le loyer + transport domicile-travail ne doivent pas étouffer le salaire net (idéalement loyer <= 25-30% du net). Compare intelligemment les communes (Yopougon, Abobo/Dokui, Koumassi, Cocody Angré/Palmeraie, Marcory, Bingerville).
4. Éduque sur le passage Salaire Brut -> Salaire Net en Côte d'Ivoire (CNPS 6.3%, CMU 1 000 FCFA, ITS) et la gestion de la CIE prépayée, SODECI, tontines et urgences familiales ("la taxe familiale").
5. Réponds de manière structurée, concise et actionnable (avec des puces claires).
6. Salaire variable (heures supplémentaires) : base toujours les charges fixes (loyer, factures, tontines) sur le salaire NET FIXE, jamais sur les heures supplémentaires. Conseille de mettre 70 % de la prime nette d'heures supplémentaires dans les coffres d'épargne et de garder 30 % pour le plaisir et les paniers repas.`;

const TONE_RULES = {
  pro: "Ton : conseiller professionnel, clair et courtois, sans argot.",
  nouchi:
    "Ton : grand frère d'Abidjan bienveillant. Parle en français ivoirien familier avec quelques expressions nouchi courantes et inoffensives (« mon gars », « on est ensemble », « c'est chaud », « gbê »), humour chaleureux, jamais vulgaire ni moqueur. Les conseils restent précis et chiffrés. Phrases courtes, 1 ou 2 emojis au plus : le message doit pouvoir être partagé tel quel sur WhatsApp.",
} as const;

interface VariablePayContext {
  fixedNet: number;
  overtimeNetGain: number;
}

function variablePayLine(v?: VariablePayContext): string {
  if (!v || v.overtimeNetGain <= 0) return "";
  return `Salaire variable : net fixe ${formatFCFA(v.fixedNet)} (base des charges fixes). Prime nette d'heures sup ce mois : ${formatFCFA(v.overtimeNetGain)} → ${formatFCFA(Math.round(v.overtimeNetGain * 0.7))} à épargner (70 %), ${formatFCFA(Math.round(v.overtimeNetGain * 0.3))} pour le plaisir et les paniers repas (30 %).`;
}

interface MealsContext {
  overtimeHours: number;
  overtimeNetGain: number;
  foodTotal: number;
  fastFoodTotal: number;
  deliveryTotal: number;
  fastFoodCount: number;
  primeSharePercent: number | null;
  level: string;
}

function mealsLine(m?: MealsContext): string {
  if (!m || m.foodTotal <= 0) return "";
  const prime =
    m.overtimeHours > 0
      ? ` Prime nette d'heures sup : ${formatFCFA(m.overtimeNetGain)} (${m.overtimeHours} h)${
          m.primeSharePercent !== null ? `, dont ${m.primeSharePercent} % dépensés en fast-food/livraison` : ""
        }.`
      : "";
  return `Restauration du mois : ${formatFCFA(m.foodTotal)} dont ${formatFCFA(m.fastFoodTotal)} en fast-food/livraison (${m.fastFoodCount} achats).${prime}`;
}

function buildSmartFallbackReply(
  question: string,
  wallets: WalletInfo[],
  transactions: Transaction[],
  meals?: MealsContext
): string {
  // Les virements entre conjoints ne sont ni des revenus ni des dépenses.
  transactions = transactions.filter((t) => !isInternalTransfer(t));
  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
  const waveWallet = wallets.find((w) => w.id === "wave")?.balance || 0;
  const djamoWallet = wallets.find((w) => w.id === "djamo")?.balance || 0;

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  const transportSpend = transactions
    .filter((t) => t.type === "expense" && t.category.includes("Transport"))
    .reduce((s, t) => s + t.amount, 0);

  const rentSpend = transactions
    .filter((t) => t.type === "expense" && t.category.includes("Loyer"))
    .reduce((s, t) => s + t.amount, 0);

  const savingsRatio =
    totalBalance > 0 ? Math.round((djamoWallet / totalBalance) * 100) : 0;

  return `👋 **Ici Kpakpato ! On se dit les gbê sur tes finances actuelles :**

- **Patrimoine total disponible :** Tu as actuellement **${formatFCFA(totalBalance)}** répartis sur tes 6 portefeuilles (dont **${formatFCFA(waveWallet)}** sur Wave et **${formatFCFA(djamoWallet)}** sur Djamo).
- **Bilan des flux :** Tes entrées totalisent **${formatFCFA(totalIncome)}** contre **${formatFCFA(totalExpense)}** de dépenses enregistrées.
- **Diagnostic Portefeuilles :** ${
    waveWallet > djamoWallet
      ? `Attention, tu as plus d'argent sur **Wave (${formatFCFA(waveWallet)})** que sur **Djamo (${formatFCFA(djamoWallet)})**. À Abidjan, l'argent qui dort sur Wave part vite en QR code ou dépannage ! Bascule au moins **${formatFCFA(Math.round(waveWallet * 0.35))}** vers un coffre bloqué.`
      : `Bravo ! ${savingsRatio}% de ton solde est sécurisé sur Djamo (${formatFCFA(djamoWallet)}), loin des tentations de dépenses impulsives.`
  }
- **Loyer & Transport à Abidjan :** ${
    rentSpend > 0
      ? `Tes charges de logement/factures sont à **${formatFCFA(rentSpend)}** et ton transport à **${formatFCFA(transportSpend)}**. Veille à ce que le duo (Loyer + Yango/Wôrô-wôrô) reste sous **35% de ton revenu net**.`
      : `Pense à enregistrer ton loyer et tes rechargements CIE prépayés dès le début du mois pour connaître ton vrai reste à vivre.`
  }
${
    meals && meals.foodTotal > 0
      ? `- **Repas & primes :** ${mealsLine(meals)} ${
          meals.fastFoodTotal > 0
            ? `Passe à des paniers repas faits maison (un seul passage au marché pour la semaine) : vise **${formatFCFA(Math.round(meals.fastFoodTotal * 0.5))}** de courses au lieu de ${formatFCFA(meals.fastFoodTotal)} et mets la différence dans ton coffre dès que la prime tombe.`
            : "Continue comme ça !"
        }\n`
      : ""
  }- **Conseil actionnable pour ta question (« ${question.slice(0, 60)} ») :** Applique la méthode **50 / 30 / 20 adaptée à Abidjan** : 50% charges fixes (Loyer, CIE/SODECI, Transport, Nourriture), 20% Épargne intouchable dès la paie, 15% Tontine/Famille plafonnée, et 15% Loisirs/Chill.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message = "Analyse mes finances et donne-moi 3 conseils concrets.",
      wallets = [],
      transactions = [],
      meals,
      variablePay,
      tone,
    }: {
      message: string;
      wallets: WalletInfo[];
      transactions: Transaction[];
      meals?: MealsContext;
      variablePay?: VariablePayContext;
      tone?: "pro" | "nouchi";
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_gemini_api_key") {
      return NextResponse.json({
        reply:
          (tone === "nouchi" ? "Mon gars, on est ensemble, regarde ça bien 👇\n\n" : "") +
          buildSmartFallbackReply(message, wallets, transactions, meals),
        mode: "local-smart-advisor",
      });
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";

    const financialContext = `
Voici les données financières actuelles de l'utilisateur en FCFA :
- Portefeuilles : ${wallets
      .map((w) => `${w.shortName}: ${w.balance} FCFA`)
      .join(", ")}
- Total avoirs : ${wallets.reduce((a, b) => a + b.balance, 0)} FCFA
- 12 dernières transactions : ${transactions
      .filter((t) => !isInternalTransfer(t))
      .slice(0, 12)
      .map(
        (t) =>
          `[${t.type === "income" ? "+" : "-"}${t.amount} FCFA | ${t.category} | ${t.title} via ${t.walletId}]`
      )
      .join(" ; ")}

${mealsLine(meals)}
${variablePayLine(variablePay)}
Si l'utilisateur fait des heures supplémentaires et dépense beaucoup en fast-food ou livraisons, alerte-le avec bienveillance et propose des paniers repas faits maison (courses groupées au marché) pour épargner sa prime.

Question de l'utilisateur : ${message}
`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n7. ${TONE_RULES[tone === "nouchi" ? "nouchi" : "pro"]}` }] },
          contents: [{ role: "user", parts: [{ text: financialContext }] }],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      throw new Error(`Gemini ${geminiRes.status}: ${errBody.slice(0, 300)}`);
    }

    const data = await geminiRes.json();
    const parts: { text?: string; thought?: boolean }[] =
      data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join("");
    if (!text) throw new Error("Gemini : réponse vide");

    return NextResponse.json({
      reply: text,
      mode: "gemini-live",
    });
  } catch (error) {
    console.error("Erreur API Kpakpato:", error);
    return NextResponse.json(
      {
        reply:
          "Désolé mon champion, le conseiller IA est momentanément indisponible. Réessaie dans un instant !",
        mode: "error-fallback",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 200 }
    );
  }
}
