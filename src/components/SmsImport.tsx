"use client";

import React, { useEffect, useMemo, useState } from "react";
import { describeSms as describe, isFromDjamo, useSmsImporter } from "@/hooks/useSmsImporter";
import { formatFCFA } from "@/lib/finance-utils";
import { parseSmsBatch } from "@/lib/sms-parser";
import {
  consumePendingImport,
  isAutoImportEnabled,
  isClipboardWatchEnabled,
  setAutoImportEnabled,
  setClipboardWatchEnabled,
  subscribePendingImport,
} from "@/lib/import-inbox";
import { TransactionCategory, WalletId } from "@/types/finance";
import { MessageSquareText, X } from "lucide-react";

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
  "Autre",
];

export default function SmsImport({ onClose }: { onClose: () => void }) {
  const { wallets, walletName, prepare, importable: pickImportable, importItems } = useSmsImporter();
  const [walletOverrides, setWalletOverrides] = useState<Record<string, WalletId>>({});
  const [watching, setWatching] = useState(false);
  const [autoImport, setAutoImport] = useState(false);
  const [text, setText] = useState("");
  const [categories, setCategories] = useState<Record<string, TransactionCategory>>({});
  const [done, setDone] = useState<string | null>(null);

  // Texte déposé par le détecteur de presse-papiers ou par le partage Android.
  useEffect(() => {
    const take = () => {
      const incoming = consumePendingImport();
      if (incoming) {
        setText(incoming);
        setDone(null);
      }
      setWatching(isClipboardWatchEnabled());
      setAutoImport(isAutoImportEnabled());
    };
    take();
    return subscribePendingImport(take);
  }, []);

  const { parsed, unrecognized } = useMemo(() => parseSmsBatch(text), [text]);

  const items = prepare(parsed, walletOverrides);
  const importable = pickImportable(items);

  const handleImport = async () => {
    const { count, recalibrated } = await importItems(importable, categories);
    setDone(`${count} SMS importé(s).${recalibrated ? " Soldes recalés sur ceux des opérateurs." : ""}`);
    setText("");
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-800/80 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-white">
          <MessageSquareText className="w-4 h-4 text-kpakpato-orange" />
          Importer des SMS / reçus Orange Money & Wave
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white" title="Fermer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        Collez un SMS, une notification (« compte débité / crédité ») ou un reçu. Sur Android, vous pouvez aussi
        partager le texte vers Kpakpato.
      </p>

      <label className="flex items-start gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={watching}
          onChange={async (e) => {
            const on = e.target.checked;
            setWatching(on);
            setClipboardWatchEnabled(on);
            // Déclenche tout de suite la demande d'autorisation du presse-papiers.
            if (on) await navigator.clipboard?.readText().catch(() => undefined);
          }}
          className="mt-0.5"
        />
        <span>
          Me proposer d&apos;importer quand je copie un SMS de transaction. Le texte copié n&apos;est lu que sur votre
          appareil, et seulement quand vous revenez sur l&apos;app.
        </span>
      </label>

      {watching && (
        <label className="flex items-start gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={autoImport}
            onChange={(e) => {
              setAutoImport(e.target.checked);
              setAutoImportEnabled(e.target.checked);
            }}
            className="mt-0.5"
          />
          <span>
            Importer automatiquement, sans me demander. Les doublons sont ignorés et les cas incertains (portefeuille
            non précisé) restent à confirmer. Vous pouvez supprimer une opération depuis l&apos;historique.
          </span>
        </label>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDone(null);
        }}
        rows={5}
        placeholder="Collez un ou plusieurs SMS (séparés par une ligne vide)"
        className="w-full rounded-lg bg-slate-900 p-3 text-xs text-white outline-none ring-1 ring-slate-600"
      />

      {done && <p className="text-xs font-semibold text-emerald-400">{done}</p>}

      {items.map(({ sms, key, duplicate, internal }) => (
        <div
          key={key}
          className={`rounded-xl bg-slate-900/80 p-3 text-xs text-slate-200 ${
            duplicate ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center justify-between font-bold">
            <span>{describe(sms)}</span>
            <span className={sms.type === "income" ? "text-emerald-400" : "text-rose-400"}>
              {sms.type === "income" ? "+" : "-"}
              {formatFCFA(sms.amount)}
            </span>
          </div>
          <p className="mt-1 text-slate-400">
            {walletName(sms.walletId)} · Frais {formatFCFA(sms.fee)} ·{" "}
            {sms.balance !== null ? `Solde après : ${formatFCFA(sms.balance)}` : "Solde non indiqué"}
            {sms.date ? ` · ${new Date(sms.date).toLocaleString("fr-FR")}` : ""}
            {sms.txId ? ` · ID ${sms.txId}` : ""}
          </p>
          {sms.walletGuessed && !duplicate && (
            <label className="mt-2 flex items-center gap-2 text-amber-300">
              Quel portefeuille ?
              <select
                value={walletOverrides[key] ?? sms.walletId}
                onChange={(e) => setWalletOverrides((prev) => ({ ...prev, [key]: e.target.value as WalletId }))}
                className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-white outline-none ring-1 ring-slate-600"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.shortName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {internal && (
            <p className="mt-1 text-kpakpato-orange">
              Enregistré comme « Virement interne au foyer » : exclu de vos dépenses et revenus.
            </p>
          )}
          {isFromDjamo(sms) && (
            <p className="mt-1 text-kpakpato-orange">
              Enregistré comme transfert Djamo → Wave (pas comme un revenu).
            </p>
          )}
          {duplicate ? (
            <p className="mt-1 font-semibold text-amber-400">Déjà importé — ignoré.</p>
          ) : (
            !isFromDjamo(sms) &&
            !internal &&
            sms.type === "expense" && (
              <select
                value={categories[key] ?? "Autre"}
                onChange={(e) =>
                  setCategories((prev) => ({ ...prev, [key]: e.target.value as TransactionCategory }))
                }
                className="mt-2 w-full rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-slate-600"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )
          )}
        </div>
      ))}

      {unrecognized.length > 0 && (
        <p className="text-xs text-amber-400">
          {unrecognized.length} message(s) non reconnu(s) et ignoré(s).
        </p>
      )}

      <button
        onClick={handleImport}
        disabled={importable.length === 0}
        className="w-full rounded-xl bg-kpakpato-green py-2 text-sm font-bold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-40"
      >
        Importer {importable.length > 0 ? `(${importable.length})` : ""}
      </button>
    </div>
  );
}
