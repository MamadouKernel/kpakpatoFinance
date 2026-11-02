"use client";

import React, { useEffect, useState } from "react";
import { ClipboardPaste, X } from "lucide-react";
import { formatFCFA } from "@/lib/finance-utils";
import {
  isClipboardWatchEnabled,
  markClipboardSeen,
  setPendingImport,
  subscribePendingImport,
  wasClipboardSeen,
} from "@/lib/import-inbox";
import { parseSmsBatch } from "@/lib/sms-parser";

interface Detected {
  text: string;
  count: number;
  first: string;
}

/**
 * Quand l'utilisateur revient sur l'app, regarde si le texte copié est un SMS ou une
 * notification de transaction et propose de l'importer. Désactivé tant que l'option n'est pas cochée.
 */
export default function ClipboardWatcher({ onImport }: { onImport: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [detected, setDetected] = useState<Detected | null>(null);

  useEffect(() => {
    setEnabled(isClipboardWatchEnabled());
    return subscribePendingImport(() => setEnabled(isClipboardWatchEnabled()));
  }, []);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.clipboard?.readText) return;

    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (!text || text.length > 5000 || wasClipboardSeen(text)) return;
        const { parsed } = parseSmsBatch(text);
        if (parsed.length === 0) return;
        const p = parsed[0];
        setDetected({
          text,
          count: parsed.length,
          first: `${p.type === "income" ? "+" : "-"}${formatFCFA(p.amount)}`,
        });
      } catch {
        // Autorisation refusée ou page non active : on ne fait rien.
      }
    };

    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled]);

  if (!detected) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-[80] flex justify-center px-3">
      <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-kpakpato-green/50 bg-slate-900 p-3 shadow-xl">
        <ClipboardPaste className="h-5 w-5 shrink-0 text-kpakpato-green" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">
            {detected.count > 1 ? `${detected.count} transactions copiées` : "Transaction copiée"} · {detected.first}
          </p>
          <p className="text-[11px] text-slate-400">Importer dans Kpakpato ?</p>
        </div>
        <button
          onClick={() => {
            markClipboardSeen(detected.text);
            setPendingImport(detected.text);
            setDetected(null);
            onImport();
          }}
          className="rounded-xl bg-kpakpato-green px-3 py-1.5 text-xs font-bold text-white"
        >
          Importer
        </button>
        <button
          onClick={() => {
            markClipboardSeen(detected.text);
            setDetected(null);
          }}
          aria-label="Ignorer"
          className="text-slate-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
