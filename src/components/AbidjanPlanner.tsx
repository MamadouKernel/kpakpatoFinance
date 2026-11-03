"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, PiggyBank, ShieldCheck } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { useSalary } from "@/context/SalaryContext";
import {
  COMMUNES,
  HOUSING_LABELS,
  OVERTIME_SAVE_SHARE,
  RENT_RATIO,
  TRANSPORT_LABELS,
  estimateCommute,
  rentCap,
  type Housing,
  type TransportMode,
} from "@/lib/abidjan-data";
import { formatFCFA } from "@/lib/finance-utils";
import { calcPayroll, netFromGross } from "@/lib/payroll";
import { monthsToReach, projectSavings } from "@/lib/savings-projection";
import type { WalletId } from "@/types/finance";

const STORAGE_KEY = "kpakpato_planner_v1";
const card = "rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4";
const field =
  "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-600 focus:ring-kpakpato-orange";

interface PlannerState {
  manualNet: number;
  workCommune: string;
  housing: Housing;
  mode: TransportMode;
  monthlySave: number;
  initial: number;
  ratePct: number;
  fixedCharges: number;
  goalEquip: number;
  goalLand: number;
  savedMonth: string;
}

const DEFAULTS: PlannerState = {
  manualNet: 0,
  workCommune: "plateau",
  housing: "studio",
  mode: "commun",
  monthlySave: 0,
  initial: 0,
  ratePct: 0,
  fixedCharges: 0,
  goalEquip: 1_000_000,
  goalLand: 3_000_000,
  savedMonth: "",
};

function duration(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y > 0 ? `${y} an${y > 1 ? "s" : ""}` : "", m > 0 ? `${m} mois` : ""].filter(Boolean).join(" ");
}

const RATES = [
  { value: 0, label: "Coffre bloqué, sans rendement (0 %)" },
  { value: 3, label: "Compte épargne (≈ 3 % par an)" },
  { value: 5, label: "DAT (≈ 5 % par an)" },
];

function Money({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <label className="block text-xs text-slate-300">
      {label}
      <input
        className={`${field} mt-1`}
        type="number"
        inputMode="numeric"
        min={0}
        step={1000}
        placeholder="0"
        value={value === 0 ? "" : value}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? Math.round(n) : 0);
        }}
      />
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export default function AbidjanPlanner() {
  const { profile } = useSalary();
  const { wallets, transferBetweenWallets } = useFinance();
  const [s, setS] = useState<PlannerState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [source, setSource] = useState<WalletId>("wave");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (raw && typeof raw === "object") setS({ ...DEFAULTS, ...raw });
    } catch {
      // stockage indisponible : valeurs par défaut
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // ignoré
    }
  }, [s, loaded]);

  const update = (patch: Partial<PlannerState>) => setS((prev) => ({ ...prev, ...patch }));

  // Salaire net FIXE : base + primes imposables, sans les heures supplémentaires (aléatoires).
  const payrollFixedNet = useMemo(
    () => netFromGross(profile.baseGross + profile.taxableBonuses, profile.parts).net,
    [profile.baseGross, profile.taxableBonuses, profile.parts]
  );
  const fixedNet = payrollFixedNet > 0 ? payrollFixedNet : s.manualNet;
  const overtimeNetGain = useMemo(
    () => Math.max(0, calcPayroll(profile).net - payrollFixedNet),
    [profile, payrollFixedNet]
  );

  const cap = rentCap(fixedNet);
  const work = COMMUNES.find((c) => c.id === s.workCommune) ?? COMMUNES[0];

  const comparison = useMemo(
    () =>
      COMMUNES.map((home) => {
          const rent = home.rent[s.housing];
          const commute = home.id === work.id ? { km: 0, monthlyCost: 0, dailyMinutes: 0 } : estimateCommute(home, work, s.mode);
          return { home, rent, commute, total: rent + commute.monthlyCost };
        })
        .sort((a, b) => a.total - b.total),
    [s.housing, s.mode, work]
  );

  // Charges fixes : toujours calculées sur le net fixe, jamais sur les heures supplémentaires.
  const fixedCharges = s.fixedCharges > 0 ? s.fixedCharges : Math.round(fixedNet * 0.5);
  const overtimeSave = Math.round(overtimeNetGain * OVERTIME_SAVE_SHARE);
  const overtimeEnjoy = Math.round(overtimeNetGain - overtimeSave);
  const monthlyTotal = s.monthlySave + overtimeSave;

  const points = useMemo(() => projectSavings(s.initial, monthlyTotal, s.ratePct), [s.initial, monthlyTotal, s.ratePct]);
  const at = (m: number) => points[m]?.balance ?? 0;
  const goals = [
    { label: "Fonds d'urgence · 3 mois de charges", target: fixedCharges * 3, icon: "🛟" },
    { label: "Fonds d'urgence · 6 mois de charges", target: fixedCharges * 6, icon: "🛡️" },
    { label: "Équipement du foyer, mariage ou voyage", target: s.goalEquip, icon: "🏠", edit: "goalEquip" as const },
    { label: "Apport terrain, immobilier ou business", target: s.goalLand, icon: "🏗️", edit: "goalLand" as const },
  ];

  const thisMonth = new Date().toISOString().slice(0, 7);
  const alreadyDone = s.savedMonth === thisMonth;
  const savable = wallets.find((w) => w.id === source)?.balance ?? 0;

  const putAside = async () => {
    if (overtimeSave <= 0 || alreadyDone) return;
    const target = wallets.find((w) => w.id === "djamo") ? "djamo" : wallets.find((w) => w.id !== source)?.id;
    if (!target) return;
    await transferBetweenWallets(source, target, overtimeSave, "Prime d'heures sup : 70 % mis de côté");
    update({ savedMonth: thisMonth });
    setDone(`${formatFCFA(overtimeSave)} mis de côté dans ${wallets.find((w) => w.id === target)?.shortName}.`);
  };

  return (
    <section className="space-y-4">
      <div className={card}>
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Building2 className="h-4 w-4 text-kpakpato-orange" /> Où habiter à Abidjan
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Règle d&apos;or : le loyer ne dépasse pas {Math.round(RENT_RATIO * 100)} % de votre salaire net fixe, sans compter les
          heures supplémentaires, qui ne sont pas garanties.
        </p>

        {payrollFixedNet === 0 && (
          <div className="mt-3">
            <Money
              label="Votre salaire net fixe (ou renseignez votre salaire dans « Revenus & Primes »)"
              value={s.manualNet}
              onChange={(n) => update({ manualNet: n })}
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-900/70 p-3">
            <p className="text-[11px] text-slate-400">Net fixe</p>
            <p className="text-sm font-extrabold text-white">{formatFCFA(fixedNet)}</p>
          </div>
          <div className="rounded-xl bg-emerald-500/10 p-3">
            <p className="text-[11px] text-emerald-300">Loyer maximum conseillé</p>
            <p className="text-sm font-extrabold text-emerald-300">{formatFCFA(cap)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-300">
            Je travaille à
            <select className={`${field} mt-1`} value={s.workCommune} onChange={(e) => update({ workCommune: e.target.value })}>
              {COMMUNES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-300">
            Logement
            <select className={`${field} mt-1`} value={s.housing} onChange={(e) => update({ housing: e.target.value as Housing })}>
              {(Object.keys(HOUSING_LABELS) as Housing[]).map((h) => (
                <option key={h} value={h}>
                  {HOUSING_LABELS[h]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Mode de transport">
          {(Object.keys(TRANSPORT_LABELS) as TransportMode[]).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={s.mode === m}
              onClick={() => update({ mode: m })}
              className={`rounded-xl border px-2 py-2 text-[11px] font-bold ${
                s.mode === m ? "border-kpakpato-orange bg-kpakpato-orange/15 text-white" : "border-slate-700 text-slate-300"
              }`}
            >
              {TRANSPORT_LABELS[m]}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-bold text-white">Loyer + transport jusqu&apos;à {work.name}</p>
        <ul className="mt-2 space-y-2">
          {comparison.map(({ home, rent, commute, total }, idx) => {
            const overCap = fixedNet > 0 && rent > cap;
            const share = fixedNet > 0 ? Math.round((total / fixedNet) * 100) : null;
            return (
              <li
                key={home.id}
                className={`rounded-xl border p-3 ${idx === 0 ? "border-emerald-500/60 bg-emerald-500/5" : "border-slate-700/60 bg-slate-900/50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-white">
                    {home.name}
                    {idx === 0 && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">le moins cher au total</span>}
                  </p>
                  <p className="text-xs font-extrabold text-white">{formatFCFA(total)}</p>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Loyer {formatFCFA(rent)} + transport {formatFCFA(commute.monthlyCost)}
                  {commute.dailyMinutes > 0 ? ` · ≈ ${commute.dailyMinutes} min de trajet par jour` : " · sur place"}
                  {share !== null ? ` · ${share} % du net` : ""}
                </p>
                {overCap && <p className="mt-1 text-[11px] font-semibold text-amber-400">Le loyer dépasse le plafond conseillé.</p>}
                {!overCap && commute.dailyMinutes >= 90 && (
                  <p className="mt-1 text-[11px] font-semibold text-amber-400">
                    Trajet long : la fatigue et le temps perdu comptent autant que l&apos;économie de loyer.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[10px] leading-snug text-slate-500">
          Estimations indicatives, pas des statistiques officielles : loyers moyens par commune, transport calculé d&apos;après la
          distance. Vérifiez sur des annonces réelles avant de décider.
        </p>
      </div>

      <div className={card}>
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
          <PiggyBank className="h-4 w-4 text-kpakpato-orange" /> Mes projets d&apos;avenir
        </h2>
        <p className="mt-1 text-xs text-slate-400">Choisissez ce que vous mettez de côté chaque mois et regardez ce que cela devient.</p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Money label="Épargne mensuelle automatique" value={s.monthlySave} onChange={(n) => update({ monthlySave: n })} />
          <Money label="Déjà épargné" value={s.initial} onChange={(n) => update({ initial: n })} />
        </div>
        <label className="mt-3 block text-xs text-slate-300">
          Où est placé l&apos;argent
          <select className={`${field} mt-1`} value={s.ratePct} onChange={(e) => update({ ratePct: Number(e.target.value) })}>
            {RATES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <Money
          label="Charges fixes par mois (loyer, factures, tontines)"
          value={s.fixedCharges}
          onChange={(n) => update({ fixedCharges: n })}
          hint={s.fixedCharges === 0 ? `Par défaut : la moitié du net fixe (${formatFCFA(Math.round(fixedNet * 0.5))}).` : undefined}
        />

        {overtimeSave > 0 && (
          <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-[11px] text-emerald-200">
            + {formatFCFA(overtimeSave)} par mois viennent de vos heures supplémentaires ({Math.round(OVERTIME_SAVE_SHARE * 100)} % de la prime).
            Total mis de côté : <strong>{formatFCFA(monthlyTotal)}</strong> par mois.
          </p>
        )}

        <div className="mt-4 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF7900" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#FF7900" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" ticks={[0, 12, 24, 36]} tickFormatter={(m) => (m === 0 ? "0" : `${m} mois`)} stroke="#94a3b8" fontSize={10} />
              <YAxis width={44} stroke="#94a3b8" fontSize={10} tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)} M` : `${Math.round(v / 1000)} k`)} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => [formatFCFA(v), "Capital"]}
                labelFormatter={(m) => `Mois ${m}`}
              />
              <Area type="monotone" dataKey="balance" stroke="#FF7900" strokeWidth={2} fill="url(#savingsFill)" isAnimationActive={false} />
              {[12, 24, 36].map((m) => (
                <ReferenceDot key={m} x={m} y={at(m)} r={4} fill="#22c55e" stroke="none" />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[12, 24, 36].map((m) => (
            <div key={m} className="rounded-xl bg-slate-900/70 p-2">
              <p className="text-[10px] text-slate-400">{m / 12} an{m > 12 ? "s" : ""}</p>
              <p className="text-xs font-extrabold text-white">{formatFCFA(at(m))}</p>
            </div>
          ))}
        </div>

        <ul className="mt-4 space-y-2">
          {goals.map((g) => {
            const reach = monthsToReach(g.target, s.initial, monthlyTotal, s.ratePct);
            const pct = g.target > 0 ? Math.min(100, Math.round((at(36) / g.target) * 100)) : 0;
            return (
              <li key={g.label} className="rounded-xl bg-slate-900/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-white">
                    {g.icon} {g.label}
                  </p>
                  <p className="shrink-0 text-xs font-extrabold text-white">{formatFCFA(g.target)}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
                  <div className="h-full rounded-full bg-kpakpato-green" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {reach === null
                    ? "Hors de portée à ce rythme : augmentez l'épargne mensuelle."
                    : reach === 0
                      ? "Déjà atteint."
                      : `Atteint en ${duration(reach)}`}
                  {" · "}
                  {pct} % à 3 ans
                </p>
                {g.edit && (
                  <div className="mt-2">
                    <Money label="Objectif" value={s[g.edit]} onChange={(n) => update({ [g.edit]: n } as Partial<PlannerState>)} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className={card}>
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
          <ShieldCheck className="h-4 w-4 text-kpakpato-orange" /> Protéger mon salaire variable
        </h2>
        {overtimeNetGain > 0 ? (
          <>
            <p className="mt-1 text-xs text-slate-400">
              Vos charges fixes (loyer, factures, tontines) se calculent sur votre net fixe de {formatFCFA(fixedNet)}, jamais sur les
              heures supplémentaires. La prime de ce mois, {formatFCFA(Math.round(overtimeNetGain))}, se partage ainsi :
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-500/10 p-3">
                <p className="text-[11px] text-emerald-300">70 % épargne</p>
                <p className="text-sm font-extrabold text-emerald-300">{formatFCFA(overtimeSave)}</p>
              </div>
              <div className="rounded-xl bg-amber-500/10 p-3">
                <p className="text-[11px] text-amber-300">30 % plaisir et paniers repas</p>
                <p className="text-sm font-extrabold text-amber-300">{formatFCFA(overtimeEnjoy)}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <select className={field} value={source} onChange={(e) => setSource(e.target.value as WalletId)} aria-label="Portefeuille d'où prélever">
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    Depuis {w.shortName}
                  </option>
                ))}
              </select>
              <button
                onClick={putAside}
                disabled={alreadyDone || overtimeSave <= 0 || savable < overtimeSave}
                className="shrink-0 rounded-xl bg-kpakpato-green px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                {alreadyDone ? "Déjà fait ce mois" : "Mettre de côté"}
              </button>
            </div>
            {savable < overtimeSave && !alreadyDone && (
              <p className="mt-2 text-[11px] text-amber-400">Le portefeuille choisi n&apos;a pas assez de solde pour ce montant.</p>
            )}
            {done && <p className="mt-2 text-[11px] font-semibold text-emerald-400">{done}</p>}
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Saisissez vos heures supplémentaires dans « Revenus & Primes » : Kpakpato calculera la prime nette et propose d&apos;en
            mettre {Math.round(OVERTIME_SAVE_SHARE * 100)} % de côté, le reste servant au plaisir et aux paniers repas.
          </p>
        )}
      </div>
    </section>
  );
}
