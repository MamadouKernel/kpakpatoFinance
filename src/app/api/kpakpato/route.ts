import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Transaction, WalletInfo } from "@/types/finance";
import { formatFCFA } from "@/lib/finance-utils";

const SYSTEM_PROMPT = `Tu es "Kpakpato", le conseiller financier personnel intelligent des jeunes travailleurs, freelances et étudiants à Abidjan (Côte d'Ivoire).
Ton ton est chaleureux, direct, bienveillant, légèrement teinté d'expressions ivoiriennes respectueuses ("Mon/Ma champion(ne)", "On se dit les gbê", "Faut pas que le mois finisse avant ton salaire", "Attention aux petits Yango et garba cumulés", "Coffre Djamo", "Tontine").
Tes règles d'or :
1. Toutes les sommes sont exprimées en FCFA.
2. Analyse concrètement la répartition entre les portefeuilles (Wave, Orange Money, MTN MoMo, Moov Money, Djamo, Cash) : conseille de ne pas laisser toute son épargne sur le compte Wave courant (tentation de dépense rapide) et d'isoler au moins 15-20% dans un Coffre Djamo ou compte épargne.
3. Rappelle la règle du loyer à Abidjan : le loyer + transport domicile-travail ne doivent pas étouffer le salaire net (idéalement loyer <= 25-30% du net). Compare intelligemment les communes (Yopougon, Abobo/Dokui, Koumassi, Cocody Angré/Palmeraie, Marcory, Bingerville).
4. Éduque sur le passage Salaire Brut -> Salaire Net en Côte d'Ivoire (CNPS 6.3%, CMU 1 000 FCFA, ITS) et la gestion de la CIE prépayée, SODECI, tontines et urgences familiales ("la taxe familiale").
5. Réponds de manière structurée, concise et actionnable (avec des puces claires).`;

function buildSmartFallbackReply(
  question: string,
  wallets: WalletInfo[],
  transactions: Transaction[]
): string {
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
- **Conseil actionnable pour ta question (« ${question.slice(0, 60)} ») :** Applique la méthode **50 / 30 / 20 adaptée à Abidjan** : 50% charges fixes (Loyer, CIE/SODECI, Transport, Nourriture), 20% Épargne intouchable dès la paie, 15% Tontine/Famille plafonnée, et 15% Loisirs/Chill.

*(💡 Astuce : ajoute ta clé \`GEMINI_API_KEY\` dans \`.env.local\` pour activer le moteur Gemini IA en direct !)*`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message = "Analyse mes finances et donne-moi 3 conseils concrets.",
      wallets = [],
      transactions = [],
    }: {
      message: string;
      wallets: WalletInfo[];
      transactions: Transaction[];
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_gemini_api_key") {
      return NextResponse.json({
        reply: buildSmartFallbackReply(message, wallets, transactions),
        mode: "local-smart-advisor",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    const financialContext = `
Voici les données financières actuelles de l'utilisateur en FCFA :
- Portefeuilles : ${wallets
      .map((w) => `${w.shortName}: ${w.balance} FCFA`)
      .join(", ")}
- Total avoirs : ${wallets.reduce((a, b) => a + b.balance, 0)} FCFA
- 12 dernières transactions : ${transactions
      .slice(0, 12)
      .map(
        (t) =>
          `[${t.type === "income" ? "+" : "-"}${t.amount} FCFA | ${t.category} | ${t.title} via ${t.walletId}]`
      )
      .join(" ; ")}

Question de l'utilisateur : ${message}
`;

    const result = await model.generateContent(financialContext);
    const text = result.response.text();

    return NextResponse.json({
      reply: text,
      mode: "gemini-live",
    });
  } catch (error) {
    console.error("Erreur API Kpakpato:", error);
    return NextResponse.json(
      {
        reply:
          "Désolé mon champion, le réseau a légèrement coupé. Vérifie ta clé GEMINI_API_KEY ou réessaie dans un instant !",
        mode: "error-fallback",
      },
      { status: 200 }
    );
  }
}
