"use client";

import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Bandeau discret quand le réseau est coupé : l'app continue de fonctionner sur l'appareil. */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500/90 px-3 py-1.5 text-center text-[11px] font-bold text-slate-950">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Hors ligne : vos données restent sur l&apos;appareil et se synchroniseront au retour du réseau.
    </div>
  );
}
