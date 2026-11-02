"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CalendarDays, TrendingDown, TrendingUp } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatFCFA, isInternalTransfer } from "@/lib/finance-utils";

const FEES_CATEGORY = "Frais & Commissions";
const DAY = 24 * 60 * 60 * 1000;
const NOTIFY_KEY = "kpakpato_weekly_notify_v1";
const LAST_KEY = "kpakpato_weekly_last_v1";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // stockage indisponible : sans importance
  }
}

/** Lundi (00 h) de la semaine de `d`, sous forme AAAA-MM-JJ. */
function mondayKey(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}

/** Bilan des 7 derniers jours, comparé aux 7 jours d'avant. Les virements internes au foyer sont exclus. */
export default function WeeklyReport() {
  const { transactions } = useFinance();
  const [notify, setNotify] = useState(false);
  const [denied, setDenied] = useState(false);

  const report = useMemo(() => {
    const now = Date.now();
    const sum = (from: number, to: number) => {
      let income = 0;
      let expense = 0;
      let fees = 0;
      const byCategory = new Map<string, number>();
      for (const t of transactions) {
        const time = new Date(t.date).getTime();
        if (time < from || time >= to || isInternalTransfer(t)) continue;
        if (t.type === "income") income += t.amount;
        else {
          expense += t.amount;
          if (t.category === FEES_CATEGORY) fees += t.amount;
          else byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
        }
      }
      const top = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
      return { income, expense, fees, top };
    };
    return { current: sum(now - 7 * DAY, now + 1), previous: sum(now - 14 * DAY, now - 7 * DAY) };
  }, [transactions]);

  const { current, previous } = report;
  const net = current.income - current.expense;
  const expenseDelta = current.expense - previous.expense;

  useEffect(() => {
    setNotify(read(NOTIFY_KEY) === "1" && typeof Notification !== "undefined" && Notification.permission === "granted");
  }, []);

  // Une notification par semaine, à la première ouverture de l'app (sans serveur, pas de push en arrière-plan).
  useEffect(() => {
    if (!notify || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const week = mondayKey(new Date());
    if (read(LAST_KEY) === week) return;
    write(LAST_KEY, week);
    if (current.income === 0 && current.expense === 0) return;
    const body = `Entrées ${formatFCFA(current.income)} · Dépenses ${formatFCFA(current.expense)}${
      current.fees > 0 ? ` · Frais ${formatFCFA(current.fees)}` : ""
    }`;
    const show = async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) await reg.showNotification("Bilan de ta semaine", { body, icon: "/icon-192.png" });
        else new Notification("Bilan de ta semaine", { body, icon: "/icon-192.png" });
      } catch {
        // notification impossible sur cet appareil
      }
    };
    void show();
  }, [notify, current]);

  const toggleNotify = async () => {
    if (notify) {
      write(NOTIFY_KEY, null);
      setNotify(false);
      return;
    }
    if (typeof Notification === "undefined") {
      setDenied(true);
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      write(NOTIFY_KEY, "1");
      setNotify(true);
      setDenied(false);
    } else {
      setDenied(true);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-white">
          <CalendarDays className="h-4 w-4 text-kpakpato-orange" />
          Bilan de la semaine
        </h3>
        <button
          onClick={toggleNotify}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white"
          title="Recevoir une notification chaque semaine"
        >
          {notify ? <Bell className="h-3.5 w-3.5 text-kpakpato-orange" /> : <BellOff className="h-3.5 w-3.5" />}
          {notify ? "Rappel activé" : "Me rappeler"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-900/70 p-2.5">
          <p className="text-slate-400">Entrées</p>
          <p className="mt-0.5 font-bold text-emerald-400">{formatFCFA(current.income)}</p>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-2.5">
          <p className="text-slate-400">Dépenses</p>
          <p className="mt-0.5 font-bold text-rose-400">{formatFCFA(current.expense)}</p>
        </div>
        <div className="rounded-xl bg-slate-900/70 p-2.5">
          <p className="text-slate-400">Reste</p>
          <p className={`mt-0.5 font-bold ${net >= 0 ? "text-white" : "text-rose-400"}`}>{formatFCFA(net)}</p>
        </div>
      </div>

      <ul className="space-y-1 text-xs text-slate-300">
        <li className="flex items-center gap-1.5">
          {expenseDelta > 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-rose-400" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {previous.expense === 0 && current.expense === 0
            ? "Aucune dépense ces 14 derniers jours."
            : `Dépenses ${expenseDelta > 0 ? "en hausse" : "en baisse"} de ${formatFCFA(Math.abs(expenseDelta))} par rapport à la semaine d'avant.`}
        </li>
        {current.top && (
          <li>
            Plus gros poste : <strong>{current.top[0]}</strong> ({formatFCFA(current.top[1])}).
          </li>
        )}
        {current.fees > 0 && (
          <li>
            Frais Mobile Money : <strong>{formatFCFA(current.fees)}</strong> cette semaine.
          </li>
        )}
      </ul>

      {denied && (
        <p className="text-[11px] text-amber-400">
          Les notifications sont bloquées ou indisponibles sur cet appareil. Autorisez-les dans les réglages du navigateur.
        </p>
      )}
      {notify && (
        <p className="text-[11px] text-slate-500">
          Le rappel s&apos;affiche à la première ouverture de l&apos;app de chaque semaine.
        </p>
      )}
    </section>
  );
}
