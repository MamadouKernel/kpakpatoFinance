"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { formatFCFA } from "@/lib/finance-utils";
import { parseSpokenExpenses, type SpokenExpense } from "@/lib/lifestyle";
import { categorizeByKeywords } from "@/lib/smart-categorizer";
import type { TransactionCategory, WalletId } from "@/types/finance";
import { card, field, ghostBtn, primaryBtn } from "./ui";

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const getRecognition = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

interface Row extends SpokenExpense {
  category: TransactionCategory;
}

/** Dicter ou taper « Gbaka 300 francs et garba 1000 francs » : chaque achat débite le portefeuille choisi (Cash par défaut). */
export default function QuickExpense() {
  const { wallets, addTransaction } = useFinance();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [wallet, setWallet] = useState<WalletId>("cash");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(getRecognition() !== null);
    return () => recRef.current?.stop();
  }, []);

  const analyze = (source: string) => {
    const items = parseSpokenExpenses(source);
    setRows(items.map((it) => ({ ...it, category: categorizeByKeywords(it.label) ?? "Autre" })));
    setMessage(items.length === 0 && source.trim() ? "Je n'ai pas trouvé de montant. Exemple : « gbaka 300 francs et garba 1000 francs »." : null);
  };

  const listen = () => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const heard = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>)
        .map((r) => r[0].transcript)
        .join(" ");
      setText(heard);
      analyze(heard);
    };
    rec.onerror = (e) => setMessage(e.error === "not-allowed" ? "Autorisez le micro dans le navigateur pour dicter." : "Dictée impossible : tapez votre dépense à la place.");
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setMessage(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const save = async () => {
    for (const r of rows) {
      await addTransaction({ title: r.label, amount: r.amount, type: "expense", category: r.category, walletId: wallet, note: "Saisie express" });
    }
    setMessage(`${rows.length} dépense${rows.length > 1 ? "s" : ""} enregistrée${rows.length > 1 ? "s" : ""} (${formatFCFA(total)}).`);
    setRows([]);
    setText("");
  };

  return (
    <div className={card}>
      <h3 className="flex items-center gap-2 text-sm font-extrabold text-white">
        <Mic className="h-4 w-4 text-kpakpato-orange" /> Dépense express
      </h3>
      <p className="mt-1 text-xs text-slate-400">Dites ou tapez vos achats en espèces : « gbaka 300 francs et garba 1000 francs ».</p>

      <div className="mt-3 flex gap-2">
        <input
          className={field}
          placeholder="Gbaka 300 francs et garba 1000 francs"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            analyze(e.target.value);
          }}
        />
        {supported && (
          <button
            onClick={listen}
            aria-label={listening ? "Arrêter la dictée" : "Dicter une dépense"}
            className={`shrink-0 rounded-xl px-3 ${listening ? "bg-rose-600 text-white" : "bg-kpakpato-orange text-white"} active:scale-95`}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
      </div>
      {!supported && <p className="mt-1 text-[10px] text-slate-500">La dictée n&apos;est pas disponible sur cet appareil ou ce navigateur : tapez la phrase, elle est analysée de la même façon.</p>}
      {listening && <p className="mt-2 text-xs font-semibold text-rose-300">Je vous écoute…</p>}
      {message && <p className="mt-2 text-xs font-semibold text-amber-300">{message}</p>}

      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_92px] gap-2 rounded-xl bg-slate-900/60 p-2">
              <input
                className={field}
                value={r.label}
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <input
                className={field}
                type="number"
                inputMode="numeric"
                value={r.amount}
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, amount: Math.max(0, Math.round(Number(e.target.value) || 0)) } : x)))}
              />
              <p className="col-span-2 text-[10px] text-slate-500">{r.category}</p>
            </div>
          ))}
          <label className="block text-xs text-slate-300">
            Payé avec
            <select className={`${field} mt-1`} value={wallet} onChange={(e) => setWallet(e.target.value as WalletId)}>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.shortName} ({formatFCFA(w.balance)})
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={rows.every((r) => r.amount <= 0)} className={`${primaryBtn} flex-1`}>
              Enregistrer · {formatFCFA(total)}
            </button>
            <button
              className={ghostBtn}
              onClick={() => {
                setRows([]);
                setText("");
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
