import { calcPayroll, netFromGross } from "@/lib/payroll";
import { filterTransactionsByPeriod, isInternalTransfer } from "@/lib/finance-utils";
import type { SalaryProfile } from "@/context/SalaryContext";
import type { Transaction } from "@/types/finance";

// Fast-foods et livraisons courants à Abidjan (reconnus dans le titre ou la note d'une dépense).
const DELIVERY_RE = /glovo|yango\s*(?:food|deli)|jumia\s*food|uber\s*eats|livraison|livr[eé]|deliver/i;
const FAST_FOOD_RE = /kfc|burger|pizza|fast.?food|mcdo|macdo|chicken|tacos|shawarma|domino|hamburger/i;

export type MealLevel = "none" | "ok" | "watch" | "alert";

export interface MealAnalysis {
  /** Toutes les dépenses de restauration du mois. */
  foodTotal: number;
  /** Dont fast-foods et livraisons (sans double compte). */
  fastFoodTotal: number;
  deliveryTotal: number;
  fastFoodCount: number;
  overtimeHours: number;
  /** Net gagné grâce aux HS ce mois-ci. */
  overtimeNetGain: number;
  /** Part de la prime nette HS dépensée en fast-food/livraison (0 à 1+), null sans HS. */
  primeShare: number | null;
  level: MealLevel;
  headline: string;
}

export const isFoodTx = (t: Transaction) => t.type === "expense" && t.category === "Nourriture & Garba";

const text = (t: Transaction) => `${t.title} ${t.note ?? ""}`;

export function analyzeMeals(transactions: Transaction[], salary: SalaryProfile): MealAnalysis {
  const month = filterTransactionsByPeriod(transactions, "month").filter(
    (t) => t.type === "expense" && !isInternalTransfer(t)
  );

  let foodTotal = 0;
  let fastFoodTotal = 0;
  let deliveryTotal = 0;
  let fastFoodCount = 0;

  for (const t of month) {
    const isDelivery = DELIVERY_RE.test(text(t));
    const isFast = isDelivery || FAST_FOOD_RE.test(text(t));
    if (isFoodTx(t) || isFast) foodTotal += t.amount;
    if (isFast) {
      fastFoodTotal += t.amount;
      fastFoodCount += 1;
      if (isDelivery) deliveryTotal += t.amount;
    }
  }

  const withOt = calcPayroll(salary);
  const without = netFromGross(salary.baseGross + salary.taxableBonuses, salary.parts);
  const overtimeNetGain = Math.max(0, withOt.net - without.net);
  const hasOvertime = withOt.overtimeHours > 0 && overtimeNetGain > 0;
  const primeShare = hasOvertime ? fastFoodTotal / overtimeNetGain : null;

  let level: MealLevel = "none";
  let headline = "Pas encore de dépense de restauration enregistrée ce mois-ci.";

  if (foodTotal > 0) {
    if (primeShare !== null) {
      const pct = Math.round(primeShare * 100);
      if (primeShare >= 0.25) {
        level = "alert";
        headline = `Attention : ${pct} % de ta prime d'heures supplémentaires part en fast-food et livraisons.`;
      } else if (primeShare >= 0.1) {
        level = "watch";
        headline = `${pct} % de ta prime d'heures supplémentaires part déjà en fast-food et livraisons.`;
      } else {
        level = "ok";
        headline = "Tes heures supplémentaires ne sont pas mangées par les fast-foods : bien joué.";
      }
    } else {
      const share = fastFoodTotal / foodTotal;
      if (share >= 0.4) {
        level = "watch";
        headline = `${Math.round(share * 100)} % de ton budget repas ce mois-ci est en fast-food et livraisons.`;
      } else {
        level = "ok";
        headline = "Ton budget repas est plutôt raisonnable ce mois-ci.";
      }
    }
  }

  return {
    foodTotal,
    fastFoodTotal,
    deliveryTotal,
    fastFoodCount,
    overtimeHours: withOt.overtimeHours,
    overtimeNetGain,
    primeShare,
    level,
    headline,
  };
}

export interface MealBasket {
  title: string;
  idea: string;
  items: string;
}

/** Idées de paniers repas faits maison (budget cible calculé à partir des dépenses réelles, pas de prix inventés). */
export const MEAL_BASKETS: MealBasket[] = [
  {
    title: "Panier midi de la semaine",
    idea: "Un seul passage au marché le dimanche, 5 repas préparés en une fois.",
    items: "Riz, attiéké, poisson (chinchard, thon) ou poulet, oignon, tomate, piment, huile, ail.",
  },
  {
    title: "Panier sauce & accompagnement",
    idea: "Une grosse sauce (graine, arachide, gombo) cuisinée en lot et congelée en portions.",
    items: "Viande ou poisson fumé, légumes de saison, concentré, épices, plantain ou igname.",
  },
  {
    title: "Panier groupé à deux ou entre collègues",
    idea: "Achetez en gros avec votre conjoint(e) ou un collègue et partagez la facture.",
    items: "Sacs de riz et d'attiéké, huile en bidon, œufs, sardines, légumes au kilo.",
  },
];

/** Résumé court envoyé au conseiller IA. */
export function mealContext(a: MealAnalysis) {
  return {
    overtimeHours: a.overtimeHours,
    overtimeNetGain: Math.round(a.overtimeNetGain),
    foodTotal: a.foodTotal,
    fastFoodTotal: a.fastFoodTotal,
    deliveryTotal: a.deliveryTotal,
    fastFoodCount: a.fastFoodCount,
    primeSharePercent: a.primeShare === null ? null : Math.round(a.primeShare * 100),
    level: a.level,
  };
}
