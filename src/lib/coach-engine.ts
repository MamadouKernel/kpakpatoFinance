import type { FinanceSnapshot } from "@/lib/coach-snapshot";

export type CoachTone = "pro" | "nouchi";

const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} FCFA`;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

type Intent = "savings" | "rent" | "overtime" | "fees" | "transport" | "debts" | "cie" | "tontine" | "food" | "salary" | "overview";

const INTENTS: { intent: Intent; re: RegExp }[] = [
  { intent: "cie", re: /\bcie\b|[eé]lectricit|courant|compteur|sodeci|\beau\b/i },
  { intent: "debts", re: /dette|doit|rembours|pr[eê]t|\bbons?\b|cr[eé]dit boutique|relance/i },
  { intent: "tontine", re: /tontine|cotisation|tr[eé]sor/i },
  { intent: "overtime", re: /heures?\s*sup|\bhs\b|prime|panier/i },
  { intent: "rent", re: /loyer|habiter|logement|commune|studio|d[eé]m[eé]nag/i },
  { intent: "transport", re: /transport|yango|gbaka|w[oô]r[oô]|sotra|p[eé]age|carburant|essence|uber|heetch/i },
  { intent: "fees", re: /frais|commission|co[uû]t.*(envoi|transfert)|gaspill/i },
  { intent: "food", re: /nourriture|repas|garba|manger|alimentation|fast.?food|livraison|glovo/i },
  { intent: "salary", re: /salaire|\bnet\b|\bbrut\b|cnps|\bits\b/i },
  { intent: "savings", re: /[eé]pargn|coffre|mettre de c[oô]t[eé]|[eé]conomis|projet|objectif/i },
];

export function detectIntent(q: string): Intent {
  return INTENTS.find((i) => i.re.test(q))?.intent ?? "overview";
}

const wallet = (s: FinanceSnapshot, id: string) => s.wallets.find((w) => w.id === id)?.balance ?? 0;

/**
 * Conseiller financier local : il lit vraiment la question et les chiffres de l'utilisateur et répond toujours,
 * même sans internet ou sans clé IA. Deux tons : « pro » et « nouchi » (grand frère d'Abidjan, bienveillant).
 */
export function localKpakpatoEngine(question: string, s: FinanceSnapshot, tone: CoachTone = "pro"): string {
  const n = tone === "nouchi";
  const say = (pro: string, nouchi: string) => (n ? nouchi : pro);
  const intent = detectIntent(question);
  const lines: string[] = [];
  const hello = n ? "Mon gars, on est ensemble, voilà la situation 👇" : "Voici mon analyse de votre situation :";

  const djamo = wallet(s, "djamo");
  const waveShare = pct(wallet(s, "wave"), s.total);

  switch (intent) {
    case "cie": {
      if (!s.cie || s.cie.daysLeft === null) {
        lines.push(say("Je n'ai pas encore assez de recharges CIE pour estimer votre consommation.", "Je n'ai pas encore assez de recharges CIE pour savoir à quelle vitesse ton courant file."));
        lines.push(say("Dès la deuxième recharge détectée, je calcule vos jours restants.", "Dès la deuxième recharge, je te dis combien de jours il te reste."));
      } else {
        lines.push(say(`Il vous reste environ ${s.cie.daysLeft} jour(s) d'électricité (≈ ${fcfa(s.cie.ratePerDay ?? 0)} par jour).`, `Il te reste à peu près ${s.cie.daysLeft} jour(s) de courant (≈ ${fcfa(s.cie.ratePerDay ?? 0)} par jour).`));
        if (s.cie.level !== "ok") lines.push(say("⚠️ Rechargez avant la coupure.", "⚠️ Recharge avant que ça coupe, hein !"));
      }
      break;
    }
    case "debts": {
      lines.push(say(`On vous doit ${fcfa(s.debts.owedToMe)} et vous devez ${fcfa(s.debts.iOwe)}.`, `On te doit ${fcfa(s.debts.owedToMe)} et toi tu dois ${fcfa(s.debts.iOwe)}.`));
      if (s.debts.oldestOwedTo) lines.push(say(`La plus ancienne créance est chez ${s.debts.oldestOwedTo} : une relance WhatsApp courtoise est conseillée.`, `La plus vieille, c'est chez ${s.debts.oldestOwedTo} : envoie-lui un petit rappel poli sur WhatsApp.`));
      if (s.debts.openCount === 0) lines.push(say("Aucune dette ouverte : bravo.", "Zéro dette ouverte, c'est propre !"));
      break;
    }
    case "tontine": {
      if (s.tontine.pendingMembers === 0) lines.push(say("Toutes les cotisations de ce mois sont reçues (ou aucune tontine n'est enregistrée).", "Toutes les cotisations du mois sont là, ou tu n'as pas encore enregistré de tontine."));
      else lines.push(say(`${s.tontine.pendingMembers} cotisation(s) en attente ce mois (${s.tontine.groups.join(", ")}). Envoyez le résumé au groupe WhatsApp.`, `${s.tontine.pendingMembers} cotisation(s) pas encore arrivées (${s.tontine.groups.join(", ")}). Balance le résumé dans le groupe WhatsApp.`));
      break;
    }
    case "overtime": {
      if (!s.salary || s.salary.overtimeNetGain <= 0) {
        lines.push(say("Aucune prime d'heures supplémentaires calculée : saisissez vos heures dans « Revenus & Primes ».", "Pas de prime d'heures sup calculée : remplis tes heures dans « Revenus & Primes »."));
      } else {
        const save = Math.round(s.salary.overtimeNetGain * 0.7);
        lines.push(say(`Votre prime nette d'heures sup est de ${fcfa(s.salary.overtimeNetGain)} (${s.salary.overtimeHours} h).`, `Ta prime nette d'heures sup, c'est ${fcfa(s.salary.overtimeNetGain)} (${s.salary.overtimeHours} h).`));
        lines.push(say(`Règle conseillée : 70 % en épargne (${fcfa(save)}) et 30 % pour le plaisir et les paniers repas (${fcfa(s.salary.overtimeNetGain - save)}). Vos charges fixes restent calées sur votre net fixe de ${fcfa(s.salary.fixedNet)}.`, `La règle : 70 % au coffre (${fcfa(save)}) et 30 % pour te faire plaisir et les paniers repas (${fcfa(s.salary.overtimeNetGain - save)}). Tes charges fixes, tu les bases sur ton net fixe de ${fcfa(s.salary.fixedNet)}, pas sur les HS.`));
      }
      if (s.month.fastFood > 0) lines.push(say(`Attention : ${fcfa(s.month.fastFood)} partent en fast-food et livraisons ce mois. Visez des paniers faits maison avec des courses groupées au marché.`, `Fais attention : ${fcfa(s.month.fastFood)} ont filé en fast-food et livraisons ce mois. Prépare tes paniers maison, une seule descente au marché pour la semaine.`));
      break;
    }
    case "rent": {
      if (!s.salary) lines.push(say("Renseignez votre salaire dans « Revenus & Primes » pour calculer votre loyer maximum (30 % du net fixe).", "Mets ton salaire dans « Revenus & Primes » et je te sors ton loyer max (30 % du net fixe)."));
      else lines.push(say(`Votre net fixe est de ${fcfa(s.salary.fixedNet)} : votre loyer ne devrait pas dépasser ${fcfa(s.salary.rentCap)} (30 %). Comparez loyer + transport commune par commune dans l'onglet Revenus.`, `Ton net fixe, c'est ${fcfa(s.salary.fixedNet)} : ton loyer ne doit pas dépasser ${fcfa(s.salary.rentCap)} (30 %). Regarde loyer + transport commune par commune dans l'onglet Revenus, c'est là que tu vois le vrai prix.`));
      break;
    }
    case "transport": {
      lines.push(say(`Transport ce mois : ${fcfa(s.month.transport)}${s.month.expense > 0 ? ` (${pct(s.month.transport, s.month.expense)} % de vos dépenses)` : ""}.`, `Transport ce mois : ${fcfa(s.month.transport)}${s.month.expense > 0 ? ` (${pct(s.month.transport, s.month.expense)} % de tes dépenses)` : ""}.`));
      if (s.month.transportYango > 0) lines.push(say(`Dont ${fcfa(s.month.transportYango)} en Yango, Heetch ou Uber. Passer la moitié de ces courses en gbaka ou woro-woro économiserait environ ${fcfa(s.month.transportYango * 0.5 * (2 / 3))} par mois.`, `Dont ${fcfa(s.month.transportYango)} en Yango, Heetch ou Uber. Si tu prends gbaka ou woro-woro pour la moitié, tu gardes environ ${fcfa(s.month.transportYango * 0.5 * (2 / 3))} chaque mois.`));
      break;
    }
    case "fees": {
      lines.push(say(`Frais Mobile Money payés ce mois : ${fcfa(s.month.fees)}.`, `Frais Mobile Money payés ce mois : ${fcfa(s.month.fees)}.`));
      lines.push(say("Astuces : regroupez vos envois (un gros transfert coûte moins que plusieurs petits), payez les marchands directement (souvent 0 FCFA) et utilisez le comparateur « Zéro frais » de l'onglet Quotidien.", "Astuces : groupe tes envois (un gros transfert coûte moins cher que plein de petits), paye les marchands directement (souvent 0 FCFA) et passe par le comparateur « Zéro frais » dans Quotidien."));
      break;
    }
    case "food": {
      lines.push(say(`Restauration ce mois : ${fcfa(s.month.food)}, dont ${fcfa(s.month.fastFood)} en fast-food et livraisons.`, `Bouffe ce mois : ${fcfa(s.month.food)}, dont ${fcfa(s.month.fastFood)} en fast-food et livraisons.`));
      if (s.month.fastFood > 0) lines.push(say(`Viser ${fcfa(s.month.fastFood * 0.5)} avec des paniers faits maison libérerait ${fcfa(s.month.fastFood * 0.5)}.`, `Si tu descends à ${fcfa(s.month.fastFood * 0.5)} avec des paniers maison, tu gardes ${fcfa(s.month.fastFood * 0.5)}.`));
      break;
    }
    case "salary": {
      lines.push(s.salary ? say(`Votre net fixe est de ${fcfa(s.salary.fixedNet)} : c'est sur lui que se calculent le loyer (max ${fcfa(s.salary.rentCap)}), les factures et les tontines.`, `Ton net fixe, c'est ${fcfa(s.salary.fixedNet)} : c'est dessus que tu calcules loyer (max ${fcfa(s.salary.rentCap)}), factures et tontines.`) : say("Saisissez votre salaire brut dans « Revenus & Primes » pour obtenir votre net réel (CNPS, ITS, CMU).", "Mets ton brut dans « Revenus & Primes » et je te sors ton vrai net (CNPS, ITS, CMU)."));
      break;
    }
    case "savings": {
      const base = s.month.income > 0 ? s.month.income : s.salary?.fixedNet ?? 0;
      const target = Math.round((base * 0.2) / 1000) * 1000;
      lines.push(base > 0 ? say(`Visez 20 % de vos revenus, soit environ ${fcfa(target)} par mois, mis de côté dès la paie. Sur 12 mois : ${fcfa(target * 12)}.`, `Vise 20 % de tes revenus, soit environ ${fcfa(target)} par mois, mis de côté dès que la paie tombe. En 12 mois : ${fcfa(target * 12)}.`) : say("Visez 20 % de vos revenus chaque mois, mis de côté dès la paie.", "Vise 20 % de tes revenus chaque mois, mis de côté dès la paie."));
      lines.push(say(`Votre coffre Djamo contient ${fcfa(djamo)} (${pct(djamo, s.total)} % de vos avoirs). Le simulateur « Mes projets d'avenir » (onglet Revenus) montre l'effet sur 1, 2 et 3 ans.`, `Ton coffre Djamo a ${fcfa(djamo)} (${pct(djamo, s.total)} % de tes avoirs). Le simulateur « Mes projets d'avenir » (onglet Revenus) te montre ce que ça donne en 1, 2 et 3 ans.`));
      break;
    }
    default: {
      lines.push(say(`Avoirs totaux : ${fcfa(s.total)} (${s.wallets.map((w) => `${w.name} ${fcfa(w.balance)}`).join(", ") || "aucun portefeuille"}).`, `Tes avoirs : ${fcfa(s.total)} (${s.wallets.map((w) => `${w.name} ${fcfa(w.balance)}`).join(", ") || "aucun portefeuille"}).`));
      lines.push(say(`Ce mois : entrées ${fcfa(s.month.income)}, dépenses ${fcfa(s.month.expense)}, reste ${fcfa(s.month.income - s.month.expense)}.`, `Ce mois : entrées ${fcfa(s.month.income)}, dépenses ${fcfa(s.month.expense)}, reste ${fcfa(s.month.income - s.month.expense)}.`));
      if (s.month.byCategory.length > 0) lines.push(say(`Plus gros postes : ${s.month.byCategory.slice(0, 3).map((c) => `${c.category} ${fcfa(c.amount)}`).join(", ")}.`, `Les plus gros trous : ${s.month.byCategory.slice(0, 3).map((c) => `${c.category} ${fcfa(c.amount)}`).join(", ")}.`));
      break;
    }
  }

  // Alertes utiles quel que soit le sujet.
  const alerts: string[] = [];
  if (intent !== "cie" && s.cie && s.cie.level !== "ok" && s.cie.daysLeft !== null) alerts.push(say(`⚡ Il reste environ ${s.cie.daysLeft} jour(s) d'électricité CIE.`, `⚡ Il te reste ~${s.cie.daysLeft} jour(s) de courant CIE, pense à recharger.`));
  if (waveShare >= 60 && djamo < wallet(s, "wave") && intent !== "savings") alerts.push(say(`💡 ${waveShare} % de vos avoirs dorment sur Wave : mettez au moins 15 à 20 % dans le coffre Djamo.`, `💡 ${waveShare} % de tes sous traînent sur Wave : glisse 15 à 20 % dans le coffre Djamo avant que ça parte en petites dépenses.`));
  if (s.month.expense > s.month.income && s.month.income > 0 && intent === "overview") alerts.push(say("⚠️ Vos dépenses dépassent vos entrées ce mois.", "⚠️ Tes dépenses dépassent tes entrées ce mois, on freine !"));

  return [hello, "", ...lines.map((l) => `• ${l}`), ...(alerts.length ? ["", ...alerts] : []), "", say("Posez-moi une question précise (loyer, épargne, transport, frais, dettes, CIE…) pour aller plus loin.", "Pose-moi une question précise (loyer, épargne, transport, frais, dettes, CIE…) et on creuse ensemble.")].join("\n");
}
