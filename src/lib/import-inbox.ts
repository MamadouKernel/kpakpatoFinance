/**
 * Boîte de dépôt du texte à importer (SMS, notification ou reçu copié/partagé).
 * Le détecteur de presse-papiers et la cible de partage y déposent le texte,
 * l'écran d'import le récupère.
 */

type Listener = () => void;

let pending: string | null = null;
const listeners = new Set<Listener>();

export function setPendingImport(text: string) {
  pending = text;
  listeners.forEach((l) => l());
}

/** Lit et vide le texte en attente. */
export function consumePendingImport(): string | null {
  const text = pending;
  pending = null;
  return text;
}

export function hasPendingImport(): boolean {
  return pending !== null;
}

export function subscribePendingImport(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const WATCH_KEY = "kpakpato_clipboard_watch_v1";
const SEEN_KEY = "kpakpato_clipboard_seen_v1";

export function isClipboardWatchEnabled(): boolean {
  try {
    return localStorage.getItem(WATCH_KEY) === "1";
  } catch {
    return false;
  }
}

export function setClipboardWatchEnabled(enabled: boolean) {
  try {
    localStorage.setItem(WATCH_KEY, enabled ? "1" : "0");
  } catch {
    // sans importance
  }
  listeners.forEach((l) => l());
}

/** Empreinte du dernier texte déjà proposé, pour ne pas le reproposer à chaque retour sur l'app. */
export function markClipboardSeen(text: string) {
  try {
    localStorage.setItem(SEEN_KEY, String(text.length) + ":" + text.slice(0, 80));
  } catch {
    // sans importance
  }
}

export function wasClipboardSeen(text: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === String(text.length) + ":" + text.slice(0, 80);
  } catch {
    return false;
  }
}

const AUTO_KEY = "kpakpato_auto_import_v1";

/** Import sans confirmation des textes copiés (désactivé par défaut). */
export function isAutoImportEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAutoImportEnabled(enabled: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, enabled ? "1" : "0");
  } catch {
    // sans importance
  }
}
