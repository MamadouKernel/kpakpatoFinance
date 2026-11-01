# 🇨🇮 Kpakpato Finance — PWA de Finances Personnelles & Coach IA (Abidjan)

**Kpakpato Finance** est une application web mobile (PWA) pensée pour les jeunes travailleurs, freelances et étudiants en Côte d'Ivoire :
- **Agrégation de 6 portefeuilles en FCFA** : Wave, Orange Money, MTN MoMo, Moov Money, Djamo et Cash (Espèces).
- **Traçage des dépenses & revenus** : Filtres par **Jour**, **Semaine** et **Mois**, graphiques interactifs **Recharts** et catégories adaptées au quotidien abidjanais (Garba, Yango/Wôrô-wôrô, CIE/SODECI, Tontine, Gombo, Salaire...).
- **Module Conseiller IA "Kpakpato" (Google Gemini)** :
  - Diagnostic personnalisé des dépenses et de la répartition Wave vs Coffre Djamo.
  - **Simulateur Salaire Brut ↔ Net (Côte d'Ivoire)** : Estimation CNPS (6.3%), ITS, CMU (1 000 FCFA) et règle budgétaire 50/30/20 adaptée à Abidjan.
  - **Guide Loyer par Commune d'Abidjan** : Comparateur Studio / 2 Pièces / 3 Pièces + coût mensuel du transport pour Yopougon, Cocody, Koumassi, Marcory, Abobo et Bingerville.
- **Synchronisation Cloud Firebase** (Auth Google + Firestore) avec **mode local instantané** (LocalStorage) si les clés ne sont pas encore renseignées.

## 🚀 Lancer l'application en local

```bash
cd /home/kernelmk/Documents/perso/kpakpatoFinance
npm install
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

## 🔑 Configuration des variables d'environnement (Optionnel en local, recommandé sur Vercel)

Copiez `.env.example` vers `.env.local` :

```bash
cp .env.example .env.local
```

Puis renseignez votre clé `GEMINI_API_KEY` (Google AI Studio) et vos clés `NEXT_PUBLIC_FIREBASE_*`.
*(Sans clés configurées, l'application fonctionne immédiatement avec le stockage local et le moteur de conseil Kpakpato intégré).*
