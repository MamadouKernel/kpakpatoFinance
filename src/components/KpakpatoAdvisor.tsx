"use client";

import React, { useMemo, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { useSalary } from "@/context/SalaryContext";
import { netFromGross } from "@/lib/payroll";
import { MEAL_BASKETS, analyzeMeals, mealContext } from "@/lib/meal-analysis";
import {
  ABIDJAN_COMMUNES_RENT,
  calculateIvorianSalary,
  formatFCFA,
} from "@/lib/finance-utils";
import { ChatMessage } from "@/types/finance";
import {
  Sparkles,
  Send,
  Calculator,
  Building2,
  Bot,
  CheckCircle2,
  AlertTriangle,
  PiggyBank,
  UtensilsCrossed,
} from "lucide-react";

type AdvisorSubTab = "chat" | "salary" | "meals" | "rent";

const QUICK_PROMPTS = [
  "Analyse mes dépenses et mes portefeuilles Wave/Djamo",
  "Comment épargner 50 000 FCFA par mois à Abidjan ?",
  "Mes petits Yango et Garba me ruinent, quel plan adopter ?",
  "Quel budget loyer viser avec 350 000 FCFA net ?",
  "Mes heures sup partent en fast-food, comment épargner ma prime ?",
];

export default function KpakpatoAdvisor() {
  const { wallets, transactions } = useFinance();
  const { profile: salaryProfile } = useSalary();
  const [subTab, setSubTab] = useState<AdvisorSubTab>("chat");
  const meals = useMemo(() => analyzeMeals(transactions, salaryProfile), [transactions, salaryProfile]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "kpakpato",
      content:
        "Akwaba mon champion ! Je suis **Kpakpato**, ton conseiller financier ivoirien propulsé par Gemini IA. J'analyse tes soldes (Wave, Orange Money, MTN MoMo, Moov, Djamo, Cash), ton salaire Brut/Net et ton loyer par commune à Abidjan pour t'aider à coffrer sérieusement en FCFA. On regarde quoi aujourd'hui ?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  // Salary & Rent Simulator state
  const [salaryInput, setSalaryInput] = useState<number>(350000);
  const [salaryMode, setSalaryMode] = useState<"brutToNet" | "netToBrut">("netToBrut");
  const [selectedHousingType, setSelectedHousingType] = useState<
    "studioAvg" | "deuxPiecesAvg" | "troisPiecesAvg"
  >("deuxPiecesAvg");

  const salaryDetails = calculateIvorianSalary(salaryInput, salaryMode);

  const sendToKpakpato = async (textToSend?: string) => {
    const query = (textToSend ?? inputPrompt).trim();
    if (!query || loadingAI) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputPrompt("");
    setLoadingAI(true);

    try {
      const res = await fetch("/api/kpakpato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          wallets,
          transactions,
          meals: mealContext(meals),
          // Salaire variable : les charges fixes se basent sur le net fixe ; la prime d'heures sup se partage 70 % / 30 %.
          variablePay:
            meals.overtimeNetGain > 0
              ? {
                  fixedNet: netFromGross(salaryProfile.baseGross + salaryProfile.taxableBonuses, salaryProfile.parts).net,
                  overtimeNetGain: Math.round(meals.overtimeNetGain),
                }
              : undefined,
        }),
      });
      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `k-${Date.now()}`,
        role: "kpakpato",
        content:
          data.reply ||
          "Mon gars, petit souci de connexion. Réessaie dans quelques secondes !",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "kpakpato",
          content: "Erreur réseau temporaire lors de l'appel à Kpakpato IA.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <section className="space-y-4">
      {/* Bannière Kpakpato */}
      <div className="rounded-3xl bg-gradient-to-r from-kpakpato-orange via-amber-500 to-kpakpato-green p-0.5 shadow-xl">
        <div className="rounded-[22px] bg-slate-900/95 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-kpakpato-orange to-kpakpato-green text-white shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  Le Coin du Kpakpato
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-kpakpato-orange/20 px-2.5 py-0.5 text-[10px] font-bold text-kpakpato-orange">
                  <Sparkles className="w-3 h-3" /> Gemini IA • Abidjan
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Coaching financier FCFA, Calcul Brut/Net CI & Guide Loyer par commune.
              </p>
            </div>
          </div>

          {/* Sous-navigation du module Kpakpato */}
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-slate-800 p-1">
            <button
              onClick={() => setSubTab("chat")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                subTab === "chat"
                  ? "bg-kpakpato-orange text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Coach
            </button>
            <button
              onClick={() => setSubTab("salary")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                subTab === "salary"
                  ? "bg-kpakpato-orange text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Brut/Net
            </button>
            <button
              onClick={() => setSubTab("meals")}
              className={`flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ${
                subTab === "meals"
                  ? "bg-kpakpato-orange text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              Repas
            </button>
            <button
              onClick={() => setSubTab("rent")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                subTab === "rent"
                  ? "bg-kpakpato-orange text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Loyers
            </button>
          </div>
        </div>
      </div>

      {/* ONGLET 1 : CHAT & DIAGNOSTIC GEMINI */}
      {subTab === "chat" && (
        <div className="space-y-3">
          {/* Suggestions rapides */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => sendToKpakpato(q)}
                disabled={loadingAI}
                className="shrink-0 rounded-2xl bg-slate-800 border border-slate-700/80 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-kpakpato-orange hover:text-white transition"
              >
                💬 {q}
              </button>
            ))}
          </div>

          {/* Fil de discussion */}
          <div className="max-h-[400px] overflow-y-auto space-y-3 rounded-3xl bg-slate-900/90 border border-slate-800 p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs leading-relaxed whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-kpakpato-orange text-white font-medium rounded-br-xs"
                      : "bg-slate-800 text-slate-100 border border-slate-700/70 rounded-bl-xs"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loadingAI && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 text-xs text-amber-400 animate-pulse">
                  Kpakpato inspecte tes comptes Wave, MoMo et Djamo...
                </div>
              </div>
            )}
          </div>

          {/* Barre de saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendToKpakpato();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Pose ta question financière à Kpakpato (loyer, tontine, salaire...)"
              className="flex-1 rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 text-xs text-white outline-none focus:border-kpakpato-orange"
            />
            <button
              type="submit"
              disabled={loadingAI}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-kpakpato-orange text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* ONGLET 2 : SIMULATEUR SALAIRE BRUT / NET CÔTE D'IVOIRE */}
      {subTab === "salary" && (
        <div className="space-y-4 rounded-3xl bg-slate-800/80 border border-slate-700/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-white">
              Simulateur Salaire Jeune Travailleur (Côte d&apos;Ivoire)
            </h3>
            <div className="inline-flex rounded-xl bg-slate-900 p-1">
              <button
                onClick={() => setSalaryMode("netToBrut")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  salaryMode === "netToBrut"
                    ? "bg-kpakpato-green text-white"
                    : "text-slate-400"
                }`}
              >
                Je connais mon Net
              </button>
              <button
                onClick={() => setSalaryMode("brutToNet")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  salaryMode === "brutToNet"
                    ? "bg-kpakpato-green text-white"
                    : "text-slate-400"
                }`}
              >
                Je connais mon Brut
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {salaryMode === "netToBrut"
                ? "Ton Salaire Net mensuel (en FCFA)"
                : "Ton Salaire Brut mensuel (en FCFA)"}
            </label>
            <input
              type="number"
              step={5000}
              min={60000}
              value={salaryInput}
              onChange={(e) => setSalaryInput(Number(e.target.value) || 0)}
              className="w-full rounded-2xl bg-slate-900 border border-slate-700 px-4 py-3 text-base font-extrabold text-white outline-none focus:border-kpakpato-orange"
            />
          </div>

          {/* Résultat Brut vs Net & Retenues CI */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-700">
              <p className="text-[11px] text-slate-400">Salaire Brut Estimé</p>
              <p className="mt-1 text-base font-extrabold text-slate-200">
                {formatFCFA(salaryDetails.brut)}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-500/15 p-3.5 border border-emerald-500/30">
              <p className="text-[11px] text-emerald-300">
                Salaire Net en Poche
              </p>
              <p className="mt-1 text-base font-extrabold text-emerald-400">
                {formatFCFA(salaryDetails.net)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-3.5 text-xs space-y-1.5 text-slate-300">
            <p className="font-bold text-slate-200 mb-1">
              Détail indicatif des retenues légales en CI :
            </p>
            <div className="flex justify-between">
              <span>• CNPS Retraite (~6.3%) :</span>
              <span className="font-semibold text-rose-400">
                -{formatFCFA(salaryDetails.cnps)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>• Impôt sur Traitements & Salaires (ITS) :</span>
              <span className="font-semibold text-rose-400">
                -{formatFCFA(salaryDetails.its)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>• Cotisation CMU :</span>
              <span className="font-semibold text-rose-400">
                -{formatFCFA(salaryDetails.cmu)}
              </span>
            </div>
          </div>

          {/* Répartition Budgétaire Recommandée par Kpakpato */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-kpakpato-orange flex items-center gap-1.5">
              <PiggyBank className="w-4 h-4" />
              Plan Budgétaire Kpakpato (sur ton Net)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-slate-900 p-3 border border-slate-700/80">
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  Plafond Loyer (Max 30%)
                </span>
                <p className="mt-1 text-sm font-extrabold text-white">
                  {formatFCFA(salaryDetails.maxRecommendedRent)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Au-delà, tu travailles uniquement pour ton bailleur !
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-3 border border-slate-700/80">
                <span className="text-[10px] font-bold uppercase text-emerald-400">
                  Épargne Coffre Djamo (20%)
                </span>
                <p className="mt-1 text-sm font-extrabold text-white">
                  {formatFCFA(salaryDetails.recommendedSavings)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  À virer le jour même du salaire avant toute sortie.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-3 border border-slate-700/80">
                <span className="text-[10px] font-bold uppercase text-sky-400">
                  Vie & Transport (50%)
                </span>
                <p className="mt-1 text-sm font-extrabold text-white">
                  {formatFCFA(salaryDetails.essentialNeeds)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  CIE/SODECI, Transport, Nourriture, Tontine & Famille.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 3 : CONSEILLER LOYER PAR COMMUNE D'ABIDJAN */}
      {/* ONGLET : PANIERS REPAS & HEURES SUPPLÉMENTAIRES */}
      {subTab === "meals" && (
        <div className="space-y-3">
          <div
            className={`rounded-2xl border p-4 ${
              meals.level === "alert"
                ? "border-rose-500/50 bg-rose-500/10"
                : meals.level === "watch"
                ? "border-amber-500/50 bg-amber-500/10"
                : "border-slate-700/60 bg-slate-800/80"
            }`}
          >
            <p className="flex items-center gap-2 text-sm font-extrabold text-white">
              <UtensilsCrossed className="h-4 w-4 text-kpakpato-orange" /> Tes repas ce mois-ci
            </p>
            <p className="mt-2 text-sm text-slate-100">{meals.headline}</p>
            <dl className="mt-3 space-y-1 text-xs text-slate-300">
              <div className="flex justify-between"><dt>Dépenses de restauration</dt><dd className="font-bold">{formatFCFA(meals.foodTotal)}</dd></div>
              <div className="flex justify-between"><dt>Dont fast-food et livraisons ({meals.fastFoodCount})</dt><dd className="font-bold">{formatFCFA(meals.fastFoodTotal)}</dd></div>
              {meals.deliveryTotal > 0 && (
                <div className="flex justify-between"><dt>Dont livraisons seules</dt><dd className="font-bold">{formatFCFA(meals.deliveryTotal)}</dd></div>
              )}
              {meals.overtimeHours > 0 && (
                <div className="flex justify-between"><dt>Prime nette d&apos;heures sup ({meals.overtimeHours} h)</dt><dd className="font-bold text-emerald-300">+{formatFCFA(Math.round(meals.overtimeNetGain))}</dd></div>
              )}
            </dl>
            {meals.overtimeHours === 0 && (
              <p className="mt-3 text-[11px] text-slate-400">
                Renseignez vos heures supplémentaires dans l&apos;onglet « Revenus » : je compare alors vos repas à votre prime.
              </p>
            )}
          </div>

          {meals.level !== "none" && meals.level !== "ok" && meals.fastFoodTotal > 0 && (
            <div className="rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4 text-xs text-slate-200">
              <p className="font-bold text-white">Objectif Kpakpato</p>
              <p className="mt-1">
                Faites des paniers maison : visez de ramener ces {formatFCFA(meals.fastFoodTotal)} à environ{" "}
                <b>{formatFCFA(Math.round(meals.fastFoodTotal * 0.5))}</b> de courses, et mettez la différence (
                <b>{formatFCFA(Math.round(meals.fastFoodTotal * 0.5))}</b>) dans votre Coffre Djamo avant d&apos;y toucher.
              </p>
            </div>
          )}

          {MEAL_BASKETS.map((b) => (
            <div key={b.title} className="rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4">
              <p className="text-sm font-extrabold text-white">{b.title}</p>
              <p className="mt-1 text-xs text-slate-300">{b.idea}</p>
              <p className="mt-2 text-xs text-slate-400"><b className="text-slate-200">À acheter :</b> {b.items}</p>
            </div>
          ))}

          <button
            onClick={() => {
              setSubTab("chat");
              sendToKpakpato("Analyse mes dépenses de repas et mes heures supplémentaires, puis propose-moi un panier repas pour épargner ma prime.");
            }}
            className="w-full rounded-xl bg-kpakpato-orange py-2.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95"
          >
            Demander l&apos;avis de Kpakpato IA
          </button>
        </div>
      )}

      {subTab === "rent" && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-800/80 border border-slate-700/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Où habiter à Abidjan selon ton Salaire Net ?
                </h3>
                <p className="text-xs text-slate-400">
                  Basé sur ton net de{" "}
                  <strong className="text-emerald-400">
                    {formatFCFA(salaryDetails.net)}
                  </strong>{" "}
                  (Loyer max conseillé :{" "}
                  <strong className="text-amber-400">
                    {formatFCFA(salaryDetails.maxRecommendedRent)}
                  </strong>
                  )
                </p>
              </div>
            </div>

            {/* Choix Studio / 2 Pièces / 3 Pièces */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-900 p-1">
              {(
                [
                  { key: "studioAvg", label: "Studio / 1P" },
                  { key: "deuxPiecesAvg", label: "2 Pièces (Salon+Ch)" },
                  { key: "troisPiecesAvg", label: "3 Pièces" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSelectedHousingType(item.key)}
                  className={`rounded-xl py-2 text-xs font-bold transition ${
                    selectedHousingType === item.key
                      ? "bg-kpakpato-orange text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {ABIDJAN_COMMUNES_RENT.map((c) => {
              const rentAmount = c[selectedHousingType];
              const totalWithTransport = rentAmount + c.transportAvgMonthly;
              const rentRatio =
                salaryDetails.net > 0
                  ? Math.round((rentAmount / salaryDetails.net) * 100)
                  : 100;
              const isSafe = rentRatio <= 30;

              return (
                <div
                  key={c.commune}
                  className={`rounded-2xl border p-4 transition ${
                    isSafe
                      ? "bg-slate-800/80 border-emerald-500/30"
                      : "bg-slate-800/60 border-rose-500/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">
                        {c.commune}
                      </h4>
                      <p className="text-[11px] text-slate-400">{c.vibe}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0 ${
                        isSafe
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}
                    >
                      {isSafe ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> {rentRatio}% du Net (OK)
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" /> {rentRatio}% du Net (Risqué)
                        </>
                      )}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-900/80 p-2.5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        Loyer moyen estimé
                      </span>
                      <strong className="text-white">{formatFCFA(rentAmount)} / mois</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        Loyer + Transport estimé
                      </span>
                      <strong className="text-amber-400">
                        {formatFCFA(totalWithTransport)} / mois
                      </strong>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
                    💡 <strong>Avis Kpakpato :</strong> {c.advice}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
