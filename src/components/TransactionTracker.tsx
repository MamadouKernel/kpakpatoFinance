"use client";

import React, { useMemo, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import SmsImport from "@/components/SmsImport";
import {
  filterTransactionsByPeriod,
  formatFCFA,
  isInternalTransfer,
} from "@/lib/finance-utils";
import {
  PeriodFilter,
  TransactionCategory,
  TransactionType,
  WalletId,
} from "@/types/finance";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Filter,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const CATEGORIES: TransactionCategory[] = [
  "Nourriture & Garba",
  "Transport (Yango/Gbaka/Wôrô)",
  "Loyer & Factures (CIE/SODECI)",
  "Data & Appels",
  "Famille & Tontine",
  "Sorties & Chill",
  "Salaire",
  "Gombo & Business",
  "Épargne",
  "Frais & Commissions",
  "Virement interne au foyer",
  "Autre",
];

export default function TransactionTracker() {
  const { transactions, wallets, addTransaction, deleteTransaction } = useFinance();
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [walletFilter, setWalletFilter] = useState<WalletId | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSmsImport, setShowSmsImport] = useState(false);

  // Form states
  const [txType, setTxType] = useState<TransactionType>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("Nourriture & Garba");
  const [selectedWallet, setSelectedWallet] = useState<WalletId>("wave");

  const filteredTx = useMemo(() => {
    const byPeriod = filterTransactionsByPeriod(transactions, period);
    if (walletFilter === "all") return byPeriod;
    return byPeriod.filter((t) => t.walletId === walletFilter);
  }, [transactions, period, walletFilter]);

  const { totalIncome, totalExpense } = useMemo(() => {
    return filteredTx.reduce(
      (acc, tx) => {
        if (isInternalTransfer(tx)) return acc;
        if (tx.type === "income") acc.totalIncome += tx.amount;
        else acc.totalExpense += tx.amount;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 }
    );
  }, [filteredTx]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTx
      .filter((t) => t.type === "expense" && !isInternalTransfer(t))
      .forEach((t) => {
        const shortCat = t.category.split(" ")[0];
        map.set(shortCat, (map.get(shortCat) || 0) + t.amount);
      });

    const entries = Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
    }));
    return entries.length > 0
      ? entries
      : [{ name: "Aucune dépense", value: 0 }];
  }, [filteredTx]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!title.trim() || Number.isNaN(numAmount) || numAmount <= 0) return;

    await addTransaction({
      title: title.trim(),
      amount: numAmount,
      type: txType,
      category,
      walletId: selectedWallet,
    });

    setTitle("");
    setAmount("");
    setShowAddModal(false);
  };

  const BAR_COLORS = ["#FF7900", "#009E60", "#1DC4FF", "#F59E0B", "#EC4899", "#8B5CF6"];

  return (
    <section className="space-y-4">
      {/* Barre de Filtres Jour / Semaine / Mois + Bouton Ajouter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-2xl bg-slate-800/90 p-1 border border-slate-700/60">
          {(
            [
              { id: "day", label: "Jour" },
              { id: "week", label: "Semaine" },
              { id: "month", label: "Mois" },
            ] as { id: PeriodFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                period === tab.id
                  ? "bg-kpakpato-orange text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSmsImport((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
        >
          Importer SMS
        </button>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-kpakpato-green px-4 py-2 text-xs font-bold text-white shadow-lg shadow-kpakpato-green/25 hover:brightness-110 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          Nouvelle opération
        </button>
      </div>

      {showSmsImport && <SmsImport onClose={() => setShowSmsImport(false)} />}

      {/* Filtre par Portefeuille */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <span className="text-xs text-slate-400 flex items-center gap-1 mr-1 shrink-0">
          <Filter className="w-3.5 h-3.5" /> Portefeuille:
        </span>
        <button
          onClick={() => setWalletFilter("all")}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
            walletFilter === "all"
              ? "bg-white text-slate-900"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Tous
        </button>
        {wallets.map((w) => (
          <button
            key={w.id}
            onClick={() => setWalletFilter(w.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
              walletFilter === w.id
                ? "bg-kpakpato-orange text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {w.shortName}
          </button>
        ))}
      </div>

      {/* Résumé Revenus vs Dépenses sur la période */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-800/80 border border-emerald-500/20 p-4">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
            <TrendingUp className="w-4 h-4" />
            Entrées ({period === "day" ? "Auj." : period === "week" ? "7j" : "Mois"})
          </div>
          <p className="mt-1 text-lg font-extrabold text-white">
            +{formatFCFA(totalIncome)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-800/80 border border-rose-500/20 p-4">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
            <TrendingDown className="w-4 h-4" />
            Sorties ({period === "day" ? "Auj." : period === "week" ? "7j" : "Mois"})
          </div>
          <p className="mt-1 text-lg font-extrabold text-white">
            -{formatFCFA(totalExpense)}
          </p>
        </div>
      </div>

      {/* Graphique Recharts des dépenses par catégorie */}
      <div className="rounded-2xl bg-slate-800/80 border border-slate-700/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Répartition des Dépenses (FCFA)
          </h4>
          <span className="text-[11px] text-slate-400">
            Reste net:{" "}
            <strong
              className={
                totalIncome - totalExpense >= 0 ? "text-emerald-400" : "text-rose-400"
              }
            >
              {formatFCFA(totalIncome - totalExpense)}
            </strong>
          </span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <XAxis
                dataKey="name"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${Math.round(val / 1000)}k`}
              />
              <Tooltip
                formatter={(value: number) => [formatFCFA(value), "Montant"]}
                contentStyle={{
                  backgroundColor: "#0F172A",
                  borderColor: "#334155",
                  borderRadius: "12px",
                  color: "#F8FAFC",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Liste des Transactions */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-kpakpato-orange" />
            Historique ({filteredTx.length})
          </h4>
        </div>

        {filteredTx.length === 0 ? (
          <div className="rounded-2xl bg-slate-800/50 border border-slate-700/40 p-8 text-center text-sm text-slate-400">
            Aucune transaction enregistrée sur cette période.
          </div>
        ) : (
          filteredTx.map((tx) => {
            const wallet = wallets.find((w) => w.id === tx.walletId);
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-2xl bg-slate-800/80 border border-slate-700/50 p-3.5 hover:border-slate-600 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      tx.type === "income"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {tx.type === "income" ? (
                      <ArrowDownLeft className="w-5 h-5" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{tx.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: wallet?.color || "#94A3B8" }}
                      />
                      <span className="font-medium text-slate-300">
                        {wallet?.shortName}
                      </span>
                      <span>•</span>
                      <span>{tx.category}</span>
                      <span>•</span>
                      <span>
                        {new Date(tx.date).toLocaleDateString("fr-CI", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span
                    className={`text-sm font-extrabold ${
                      tx.type === "income" ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatFCFA(tx.amount)}
                  </span>
                  <button
                    onClick={() => deleteTransaction(tx.id)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-400 transition"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal d'ajout de transaction */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-white">
                Ajouter une opération
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                Fermer
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              {/* Type Dépense / Revenu */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setTxType("expense");
                    setCategory("Nourriture & Garba");
                  }}
                  className={`rounded-xl py-2 text-xs font-bold transition ${
                    txType === "expense"
                      ? "bg-rose-500 text-white shadow"
                      : "text-slate-400"
                  }`}
                >
                  Dépense (Sortie)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType("income");
                    setCategory("Salaire");
                  }}
                  className={`rounded-xl py-2 text-xs font-bold transition ${
                    txType === "income"
                      ? "bg-emerald-500 text-white shadow"
                      : "text-slate-400"
                  }`}
                >
                  Revenu (Entrée)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Libellé (ex: Garba, Yango, Loyer, Gombo...)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Yango Cocody -> Plateau"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm text-white outline-none focus:border-kpakpato-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Montant (en FCFA)
                </label>
                <input
                  type="number"
                  required
                  min={50}
                  step={50}
                  placeholder="Ex: 2500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3.5 py-2.5 text-sm font-bold text-white outline-none focus:border-kpakpato-orange"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Portefeuille utilisé
                  </label>
                  <select
                    value={selectedWallet}
                    onChange={(e) => setSelectedWallet(e.target.value as WalletId)}
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-kpakpato-orange"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.shortName} ({formatFCFA(w.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as TransactionCategory)
                    }
                    className="w-full rounded-xl bg-slate-800 border border-slate-700 px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-kpakpato-orange"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-kpakpato-orange to-amber-500 py-3 text-sm font-extrabold text-white shadow-lg hover:brightness-110 transition"
              >
                Enregistrer en FCFA
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
