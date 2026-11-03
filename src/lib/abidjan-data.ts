/**
 * Ordres de grandeur pour les communes d'Abidjan. Ce sont des ESTIMATIONS INDICATIVES, pas des statistiques officielles :
 * les loyers varient beaucoup d'un quartier et d'une annonce à l'autre. À vérifier sur les annonces avant de décider.
 */
export interface Commune {
  id: string;
  name: string;
  /** Position approximative du centre de la commune (sert à estimer la distance au lieu de travail). */
  lat: number;
  lon: number;
  /** Loyers mensuels moyens indicatifs, en FCFA. */
  rent: { studio: number; deux: number; trois: number };
}

export const COMMUNES: Commune[] = [
  { id: "yopougon", name: "Yopougon", lat: 5.34, lon: -4.09, rent: { studio: 45_000, deux: 75_000, trois: 120_000 } },
  { id: "abobo", name: "Abobo", lat: 5.42, lon: -4.02, rent: { studio: 35_000, deux: 60_000, trois: 95_000 } },
  { id: "koumassi", name: "Koumassi", lat: 5.29, lon: -3.94, rent: { studio: 55_000, deux: 95_000, trois: 150_000 } },
  { id: "marcory", name: "Marcory", lat: 5.29, lon: -3.98, rent: { studio: 75_000, deux: 135_000, trois: 210_000 } },
  { id: "treichville", name: "Treichville", lat: 5.3, lon: -4.01, rent: { studio: 60_000, deux: 100_000, trois: 160_000 } },
  { id: "adjame", name: "Adjamé", lat: 5.35, lon: -4.03, rent: { studio: 40_000, deux: 70_000, trois: 105_000 } },
  { id: "plateau", name: "Plateau", lat: 5.32, lon: -4.02, rent: { studio: 150_000, deux: 280_000, trois: 450_000 } },
  { id: "angre", name: "Cocody Angré", lat: 5.4, lon: -3.98, rent: { studio: 85_000, deux: 150_000, trois: 240_000 } },
  { id: "riviera", name: "Cocody Riviera", lat: 5.37, lon: -3.96, rent: { studio: 110_000, deux: 190_000, trois: 300_000 } },
  { id: "deux-plateaux", name: "Cocody Deux-Plateaux", lat: 5.36, lon: -3.99, rent: { studio: 120_000, deux: 210_000, trois: 330_000 } },
  { id: "bingerville", name: "Bingerville", lat: 5.35, lon: -3.89, rent: { studio: 60_000, deux: 100_000, trois: 160_000 } },
  { id: "port-bouet", name: "Port-Bouët", lat: 5.25, lon: -3.93, rent: { studio: 45_000, deux: 80_000, trois: 125_000 } },
];

export type Housing = "studio" | "deux" | "trois";
export type TransportMode = "commun" | "yango";

export const HOUSING_LABELS: Record<Housing, string> = {
  studio: "Studio",
  deux: "2 pièces",
  trois: "3 pièces",
};

export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  commun: "Gbaka / woro-woro / SOTRA",
  yango: "Yango",
};

/** Jours de travail par mois. */
const WORK_DAYS = 22;

/** Distance à vol d'oiseau en km (formule de haversine). */
export function distanceKm(a: Commune, b: Commune): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export interface CommuteEstimate {
  km: number;
  /** Transport mensuel estimé (22 jours aller-retour). */
  monthlyCost: number;
  /** Minutes de trajet par jour (aller-retour), embouteillages compris. */
  dailyMinutes: number;
}

/** Les routes sont plus longues qu'à vol d'oiseau : on majore de 30 %. */
export function estimateCommute(home: Commune, work: Commune, mode: TransportMode): CommuteEstimate {
  const km = Math.max(0.5, distanceKm(home, work) * 1.3);
  const dailyCommun = 250 + 130 * km;
  const dailyCost = mode === "yango" ? dailyCommun * 3 : dailyCommun;
  return {
    km,
    monthlyCost: Math.round((dailyCost * WORK_DAYS) / 1000) * 1000,
    dailyMinutes: Math.round(km * 2 * 3.5),
  };
}

/** Plafond de loyer : 30 % du salaire net fixe (hors heures supplémentaires aléatoires). */
export const RENT_RATIO = 0.3;
export const rentCap = (fixedNet: number) => Math.round(fixedNet * RENT_RATIO);

/** Part des primes d'heures supplémentaires mise de côté (le reste va au plaisir et aux paniers repas). */
export const OVERTIME_SAVE_SHARE = 0.7;
