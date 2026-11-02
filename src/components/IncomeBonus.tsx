"use client";

import React, { useMemo, useState } from "react";
import { Banknote, ChevronDown } from "lucide-react";
import { useSalary, type SalaryProfile } from "@/context/SalaryContext";
import { formatFCFA } from "@/lib/finance-utils";
import { MAX_PARTS, calcPayroll, netFromGross } from "@/lib/payroll";

const card = "rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4";
const input =
  "w-full rounded-lg bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-600 focus:ring-kpakpato-orange";

const PARTS_OPTIONS = Array.from({ length: (MAX_PARTS - 1) * 2 + 1 }, (_, i) => 1 + i * 0.5);

const partsLabel = (p: number) =>
  p === 1 ? "1 part — célibataire sans enfant" : p === 2 ? "2 parts — marié(e) sans enfant" : `${p} parts`;

function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="block text-xs text-slate-300">
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          className={input}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={value === 0 ? "" : value}
          placeholder="0"
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
        />
        {suffix && <span className="shrink-0 text-slate-400">{suffix}</span>}
      </div>
    </label>
  );
}

export default function IncomeBonus() {
  const { profile, setProfile } = useSalary();
  const [showRates, setShowRates] = useState(false);

  const update = (patch: Partial<SalaryProfile>) => setProfile({ ...profile, ...patch });

  const result = useMemo(() => calcPayroll(profile), [profile]);
  const withoutOvertime = useMemo(
    () => netFromGross(profile.baseGross + profile.taxableBonuses, profile.parts),
    [profile.baseGross, profile.taxableBonuses, profile.parts]
  );
  const overtimeNetGain = Math.max(0, result.net - withoutOvertime.net);

  return (
    <section className="space-y-4">
      <div className={card}>
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
          <Banknote className="h-4 w-4 text-kpakpato-orange" /> Revenus & Primes
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Entrez votre salaire de base et vos heures supplémentaires du mois : l&apos;app calcule votre net réel.
        </p>

        <div className="mt-4 space-y-3">
          <NumberField label="Salaire de base brut mensuel" suffix="FCFA" value={profile.baseGross} onChange={(n) => update({ baseGross: n })} />
          <NumberField label="Autres primes imposables du mois (facultatif)" suffix="FCFA" value={profile.taxableBonuses} onChange={(n) => update({ taxableBonuses: n })} />

          <label className="block text-xs text-slate-300">
            Situation familiale (parts fiscales)
            <select className={`${input} mt-1`} value={profile.parts} onChange={(e) => update({ parts: Number(e.target.value) })}>
              {PARTS_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {partsLabel(p)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-extrabold text-white">Heures supplémentaires du mois</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <NumberField label={`Premières HS (+${profile.rates.first} %)`} suffix="h" step={0.5} value={profile.hours.first} onChange={(n) => update({ hours: { ...profile.hours, first: n } })} />
          <NumberField label={`HS au-delà (+${profile.rates.beyond} %)`} suffix="h" step={0.5} value={profile.hours.beyond} onChange={(n) => update({ hours: { ...profile.hours, beyond: n } })} />
          <NumberField label={`HS de nuit (+${profile.rates.night} %)`} suffix="h" step={0.5} value={profile.hours.night} onChange={(n) => update({ hours: { ...profile.hours, night: n } })} />
          <NumberField label={`Dimanche / férié (+${profile.rates.holiday} %)`} suffix="h" step={0.5} value={profile.hours.holiday} onChange={(n) => update({ hours: { ...profile.hours, holiday: n } })} />
        </div>

        <button onClick={() => setShowRates((v) => !v)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-kpakpato-orange">
          <ChevronDown className={`h-3.5 w-3.5 transition ${showRates ? "rotate-180" : ""}`} />
          Ajuster les taux de majoration
        </button>
        {showRates && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberField label="Premières HS" suffix="%" value={profile.rates.first} onChange={(n) => update({ rates: { ...profile.rates, first: n } })} />
            <NumberField label="HS au-delà" suffix="%" value={profile.rates.beyond} onChange={(n) => update({ rates: { ...profile.rates, beyond: n } })} />
            <NumberField label="HS de nuit" suffix="%" value={profile.rates.night} onChange={(n) => update({ rates: { ...profile.rates, night: n } })} />
            <NumberField label="Dimanche / férié" suffix="%" value={profile.rates.holiday} onChange={(n) => update({ rates: { ...profile.rates, holiday: n } })} />
            <p className="col-span-2 text-[11px] text-slate-500">
              Votre convention collective ou votre contrat peut prévoir des taux plus élevés : reprenez ceux de votre bulletin.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-kpakpato-orange/30 via-slate-800 to-kpakpato-green/20 p-5 ring-1 ring-slate-700/60">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-300">Net estimé du mois</p>
        <p className="mt-1 text-3xl font-black text-white">{formatFCFA(result.net)}</p>
        {result.overtimeHours > 0 && (
          <p className="mt-1 text-xs font-semibold text-emerald-300">
            Dont environ +{formatFCFA(overtimeNetGain)} net grâce à {result.overtimeHours} h supplémentaires
          </p>
        )}

        <dl className="mt-4 space-y-1.5 text-xs">
          <Row label="Salaire de base brut" value={formatFCFA(profile.baseGross)} />
          {profile.taxableBonuses > 0 && <Row label="+ Primes imposables" value={formatFCFA(profile.taxableBonuses)} />}
          {result.overtimePay > 0 && (
            <Row label={`+ Heures supplémentaires (${result.overtimeHours} h)`} value={formatFCFA(result.overtimePay)} />
          )}
          <Row label="= Brut total" value={formatFCFA(result.grossTotal)} strong />
          <Row label="− CNPS (6,3 %)" value={`-${formatFCFA(result.cnps)}`} negative />
          <Row label="− ITS (impôt)" value={`-${formatFCFA(result.its)}`} negative />
          <Row label="− CMU" value={`-${formatFCFA(result.cmu)}`} negative />
          <Row label="= Net" value={formatFCFA(result.net)} strong />
        </dl>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Estimation indicative : le taux horaire est calculé sur {173.33} h/mois, l&apos;ITS suit le barème unifié en vigueur
        depuis 2024 avec réduction pour charges de famille. Les règles exactes dépendent de votre contrat et de votre
        convention collective : votre bulletin de paie fait foi.
      </p>
    </section>
  );
}

function Row({ label, value, strong, negative }: { label: string; value: string; strong?: boolean; negative?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "border-t border-slate-700 pt-1.5 font-bold text-white" : "text-slate-300"}`}>
      <dt>{label}</dt>
      <dd className={negative ? "text-rose-300" : ""}>{value}</dd>
    </div>
  );
}
