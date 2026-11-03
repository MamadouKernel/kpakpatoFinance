"use client";

import React, { useEffect, useState } from "react";
import { isNativeApp, nativeStatus } from "@/lib/native-bridge";

type Status = NonNullable<ReturnType<typeof nativeStatus>>;

/**
 * Dans l'app Android : vérifie que l'accès aux notifications (et aux SMS dans la variante téléchargée) est accordé,
 * et propose de l'activer en un clic. Une fois tout activé, il ne reste qu'un bandeau d'état.
 */
export default function AndroidOnboarding() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;
    const refresh = () => setStatus(nativeStatus());
    refresh();
    // L'utilisateur revient des réglages d'Android : on relit l'état tout de suite.
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 3000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, []);

  if (!status) return null;

  const needsNotifications = !status.notifications;
  const needsSms = status.smsSupported && !status.sms;

  if (!needsNotifications && !needsSms) {
    return (
      <div className="mx-4 mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold text-emerald-300">
        🤖 Écoute Android active : synchronisation automatique Wave, Orange, MTN, Moov &amp; Djamo
      </div>
    );
  }

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-kpakpato-orange/50 bg-kpakpato-orange/10 p-4">
      <p className="text-sm font-extrabold text-white">Activez la capture automatique</p>
      <p className="mt-1 text-xs leading-snug text-slate-300">
        Vos transactions Wave, Orange Money, MTN, Moov et Djamo s&apos;ajouteront toutes seules, sans rien copier.
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        <li className={needsNotifications ? "text-slate-300" : "text-emerald-300"}>
          {needsNotifications ? "✘" : "✔"} Lecture des notifications
        </li>
        {status.smsSupported && (
          <li className={needsSms ? "text-slate-300" : "text-emerald-300"}>{needsSms ? "✘" : "✔"} Lecture des SMS</li>
        )}
      </ul>
      {needsNotifications && (
        <button
          onClick={() => window.KpakpatoNative?.openNotificationSettings()}
          className="mt-3 w-full rounded-xl bg-kpakpato-orange py-2.5 text-sm font-bold text-white active:scale-95"
        >
          Activer la capture automatique Android
        </button>
      )}
      {needsSms && (
        <button
          onClick={() => window.KpakpatoNative?.requestSmsPermission()}
          className="mt-2 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white ring-1 ring-slate-600 active:scale-95"
        >
          Autoriser la lecture des SMS
        </button>
      )}
      <p className="mt-3 rounded-lg bg-slate-900/70 p-2 text-[11px] leading-snug text-amber-300">
        Bouton grisé ou sans effet ? Android 13 ou plus bloque d&apos;abord les apps installées hors du Play Store : ouvrez
        Paramètres → Applications → Kpakpato Finance → menu ⋮ → « Autoriser les paramètres restreints », puis réessayez.
      </p>
    </div>
  );
}
