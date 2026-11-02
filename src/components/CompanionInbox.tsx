"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { useFinance } from "@/context/FinanceContext";
import { useSmsImporter } from "@/hooks/useSmsImporter";
import { db } from "@/lib/firebase";
import { formatFCFA } from "@/lib/finance-utils";
import { setPendingImport } from "@/lib/import-inbox";
import {
  ackNativeMessages,
  isNativeApp,
  onNativeMessage,
  peekNativeMessages,
} from "@/lib/native-bridge";
import { parseSmsBatch } from "@/lib/sms-parser";

interface InboxItem {
  id: string;
  text: string;
  /** Vient de l'app Android (file locale) plutôt que de la boîte Firestore. */
  native: boolean;
}

/**
 * Importe sans action de l'utilisateur les textes captés par l'app Android Kpakpato
 * (file locale du téléphone) ou déposés dans users/{uid}/inbox. Les cas incertains
 * (portefeuille non précisé) sont déposés dans l'écran « Importer SMS » pour confirmation.
 */
export default function CompanionInbox() {
  const { user, cloudReady } = useFinance();
  const [toast, setToast] = useState<string | null>(null);

  const importer = useSmsImporter();
  const importerRef = useRef(importer);
  importerRef.current = importer;

  const queue = useRef<InboxItem[]>([]);
  const draining = useRef(false);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid || !cloudReady) return;
    const database = db;

    const drain = async () => {
      if (draining.current) return;
      draining.current = true;
      let imported = 0;
      let received = 0;
      let lastLabel = "";
      const toConfirm: string[] = [];
      try {
        while (queue.current.length > 0) {
          const item = queue.current.shift()!;
          received += 1;
          const { parsed } = parseSmsBatch(item.text);
          if (parsed.length > 0) {
            const api = importerRef.current;
            const fresh = api.importable(api.prepare(parsed));
            const sure = fresh.filter((i) => !i.sms.walletGuessed);
            if (sure.length > 0) {
              imported += (await api.importItems(sure)).count;
              const p = sure[0].sms;
              lastLabel = `${p.type === "income" ? "+" : "-"}${formatFCFA(p.amount)}`;
            }
            if (sure.length < fresh.length) toConfirm.push(item.text);
          }
          // Non reconnu, doublon ou importé : on vide la file. Seul l'incertain est repassé à l'utilisateur.
          if (item.native) ackNativeMessages([item.id]);
          else if (database) await deleteDoc(doc(database, "users", uid, "inbox", item.id)).catch(() => undefined);
        }
      } finally {
        draining.current = false;
      }
      // Trace de la dernière réception, affichée dans « Importer depuis mon téléphone ».
      if (received > 0 && database) {
        void setDoc(
          doc(database, "users", uid),
          { companionLastAt: new Date().toISOString() },
          { merge: true }
        ).catch(() => undefined);
      }
      if (toConfirm.length > 0) setPendingImport(toConfirm.join("\n\n"));
      if (imported > 0 || toConfirm.length > 0) {
        const parts: string[] = [];
        if (imported > 0) {
          parts.push(
            `${imported > 1 ? `${imported} transactions importées` : "Transaction importée"} depuis votre téléphone${
              imported === 1 && lastLabel ? ` · ${lastLabel}` : ""
            }`
          );
        }
        if (toConfirm.length > 0) parts.push(`${toConfirm.length} à confirmer dans « Importer SMS »`);
        setToast(parts.join(" · "));
        setTimeout(() => setToast(null), 6000);
      }
    };

    const enqueue = (items: InboxItem[]) => {
      for (const it of items) {
        if (!queue.current.some((q) => q.id === it.id && q.native === it.native)) queue.current.push(it);
      }
      void drain();
    };

    const cleanups: Array<() => void> = [];

    // Boîte Firestore (utile si les messages arrivent d'un autre appareil).
    if (database) {
      cleanups.push(
        onSnapshot(
          collection(database, "users", uid, "inbox"),
          (snap) => {
            const items: InboxItem[] = [];
            for (const d of snap.docs) {
              const text = d.data().text;
              if (typeof text !== "string") void deleteDoc(d.ref).catch(() => undefined);
              else items.push({ id: d.id, text, native: false });
            }
            enqueue(items);
          },
          (err) => console.warn("Boîte de réception indisponible :", err)
        )
      );
    }

    // App Android : file locale du téléphone, relue à l'ouverture, au retour sur l'app et à chaque message.
    if (isNativeApp()) {
      const pull = () => enqueue(peekNativeMessages().map((m) => ({ ...m, native: true })));
      pull();
      cleanups.push(onNativeMessage(pull));
      const onVisible = () => {
        if (document.visibilityState === "visible") pull();
      };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", pull);
      cleanups.push(() => {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", pull);
      });
    }

    return () => cleanups.forEach((c) => c());
  }, [uid, cloudReady]);

  if (!toast) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[80] flex justify-center px-3">
      <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-kpakpato-green/50 bg-slate-900 p-3 shadow-xl">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-kpakpato-green" />
        <p className="flex-1 text-xs font-bold text-white">{toast}</p>
        <button onClick={() => setToast(null)} aria-label="Fermer" className="text-slate-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
