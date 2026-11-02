"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { useHousehold } from "@/context/HouseholdContext";
import { INTERNAL_CATEGORY, formatFCFA } from "@/lib/finance-utils";
import { isPartnerParty } from "@/lib/household-utils";
import { ParsedSms, parseSmsBatch, smsKey } from "@/lib/sms-parser";
import {
  consumePendingImport,
  isClipboardWatchEnabled,
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

function describe(sms: ParsedSms): string {
  switch (sms.kind) {
    case "om_transfer":
    case "wave_send":
      return `Transfert vers ${sms.recipient}`;
    case "om_payment":
      return sms.merchant ? `Paiement ${sms.merchant}` : "Paiement Orange Money";
    case "wave_payment":
      return `Paiement ${sms.merchant}`;
    case "wave_receive":
      return `Reçu de ${sms.sender}`;
    case "generic_debit":
      return sms.merchant ? `Paiement ${sms.merchant}` : "Compte débité";
    case "generic_credit":
      return "Compte crédité";
    default:
      return `Dépôt depuis ${sms.bank}`;
  }
}


/** Argent échangé avec le conjoint : numéro ou nom correspondant à son profil de foyer. */
function isWithPartner(sms: ParsedSms, partner: Parameters<typeof isPartnerParty>[1]): boolean {
  if (sms.kind === "om_transfer" || sms.kind === "wave_send") return isPartnerParty(sms.recipient, partner);
  if (sms.kind === "wave_receive") return isPartnerParty(sms.sender, partner);
  return false;
}

const isFromDjamo = (sms: ParsedSms) =>
  sms.kind === "wave_deposit" && /djamo/i.test(sms.bank ?? "");

export default function SmsImport({ onClose }: { onClose: () => void }) {
  const { transactions, transfers, addTransaction, transferBetweenWallets, updateWalletBalance } =
    useFinance();
  const { partner } = useHousehold();
  const { wallets } = useFinance();
  const [walletOverrides, setWalletOverrides] = useState<Record<string, WalletId>>({});
  const [watching, setWatching] = useState(false);
  const walletName = (id: WalletId) => wallets.find((w) => w.id === id)?.shortName ?? id;
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
    };
    take();
    return subscribePendingImport(take);
  }, []);

  const { parsed, unrecognized } = useMemo(() => parseSmsBatch(text), [text]);

  const knownKeys = useMemo(() => {
    const keys = new Set<string>();
    transactions.forEach((t) => t.smsKey && keys.add(t.smsKey));
    transfers.forEach((t) => t.smsKey && keys.add(t.smsKey));
    return keys;
  }, [transactions, transfers]);

  const items = parsed.map((sms) => {
    const key = smsKey(sms);
    return {
      sms: { ...sms, walletId: walletOverrides[key] ?? sms.walletId },
      key,
      duplicate: knownKeys.has(key),
      internal: isWithPartner(sms, partner),
    };
  });
  const importable = items.filter((i, idx) => !i.duplicate && items.findIndex((o) => o.key === i.key) === idx);

  const handleImport = async () => {
    // Du plus ancien au plus récent : le solde final est celui du dernier SMS.
    const ordered = [...importable].sort(
      (a, b) => (a.sms.date ?? "").localeCompare(b.sms.date ?? "")
    );
    for (const { sms, key, internal } of ordered) {
      const note = `Importé depuis SMS${sms.fee > 0 ? ` (frais ${sms.fee} FCFA)` : ""}`;
      if (isFromDjamo(sms)) {
        await transferBetweenWallets("djamo", sms.walletId, sms.amount, note, {
          date: sms.date,
          smsKey: key,
        });
      } else {
        await addTransaction({
          title: internal ? `Virement interne au foyer (${describe(sms).toLowerCase()})` : describe(sms),
          amount: sms.amount,
          type: sms.type,
          category: internal ? INTERNAL_CATEGORY : categories[key] ?? "Autre",
          walletId: sms.walletId,
          date: sms.date,
          note,
          smsKey: key,
        });
      }
      if (sms.fee > 0) {
        await addTransaction({
          title: `Frais ${walletName(sms.walletId)}`,
          amount: sms.fee,
          type: "expense",
          category: "Frais & Commissions",
          walletId: sms.walletId,
          date: sms.date,
        });
      }
      // Le solde annoncé par l'opérateur fait foi : il recale le portefeuille.
      if (sms.balance !== null) await updateWalletBalance(sms.walletId, sms.balance);
    }
    const recalibrated = ordered.some(({ sms }) => sms.balance !== null);
    setDone(
      `${ordered.length} SMS importé(s).${recalibrated ? " Soldes recalés sur ceux des opérateurs." : ""}`
    );
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
