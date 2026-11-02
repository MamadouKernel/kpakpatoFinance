"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardPaste, X } from "lucide-react";
import { useSmsImporter } from "@/hooks/useSmsImporter";
import { formatFCFA } from "@/lib/finance-utils";
import {
  isAutoImportEnabled,
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
  const [autoDone, setAutoDone] = useState<string | null>(null);

  // Toujours la dernière version de l'importeur (opérations connues, conjoint…) dans les écouteurs.
  const importer = useSmsImporter();
  const importerRef = useRef(importer);
  importerRef.current = importer;
  // « focus » et « visibilitychange » partent presque en même temps : une seule lecture à la fois.
  const running = useRef(false);

  useEffect(() => {
    setEnabled(isClipboardWatchEnabled());
    return subscribePendingImport(() => setEnabled(isClipboardWatchEnabled()));
  }, []);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.clipboard?.readText) return;

    const check = async () => {
      if (document.visibilityState !== "visible" || running.current) return;
      running.current = true;
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (!text || text.length > 5000 || wasClipboardSeen(text)) return;
        const { parsed } = parseSmsBatch(text);
        if (parsed.length === 0) return;

        const api = importerRef.current;
        const fresh = api.importable(api.prepare(parsed));
        // Déjà importé (ou doublon) : rien à proposer, on ne le reverra pas.
        if (fresh.length === 0) {
          markClipboardSeen(text);
          return;
        }

        // Import automatique : tout ce qui est sûr part tout seul, le reste est proposé.
        if (isAutoImportEnabled()) {
          const sure = fresh.filter((i) => !i.sms.walletGuessed);
          if (sure.length > 0) {
            const { count } = await api.importItems(sure);
            const first = sure[0].sms;
            setAutoDone(
              `${count > 1 ? `${count} transactions importées` : "Transaction importée"} automatiquement · ${
                first.type === "income" ? "+" : "-"
              }${formatFCFA(first.amount)}`
            );
            setTimeout(() => setAutoDone(null), 5000);
          }
          if (sure.length === fresh.length) {
            markClipboardSeen(text);
            return;
          }
          // Il reste des cas à confirmer : on garde le texte pour l'écran d'import.
        }

        const p = fresh[0].sms;
        setDetected({
          text,
          count: fresh.length,
          first: `${p.type === "income" ? "+" : "-"}${formatFCFA(p.amount)}`,
        });
      } catch {
        // Autorisation refusée ou page non active : on ne fait rien.
      } finally {
        running.current = false;
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

  if (autoDone && !detected) {
    return (
      <div className="fixed inset-x-0 bottom-20 z-[80] flex justify-center px-3">
        <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-kpakpato-green/50 bg-slate-900 p-3 shadow-xl">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-kpakpato-green" />
          <p className="flex-1 text-xs font-bold text-white">{autoDone}</p>
          <button onClick={() => setAutoDone(null)} aria-label="Fermer" className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

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
