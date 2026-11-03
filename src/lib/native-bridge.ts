/**
 * Pont avec l'app Android Kpakpato (WebView). Dans un navigateur ou une PWA, `window.KpakpatoNative`
 * n'existe pas et rien de tout cela n'est utilisé.
 */

interface NativeBridge {
  /** Lance la connexion Google native ; le résultat revient par window.__kpakpatoGoogleToken. */
  googleSignIn(): void;
  /** Textes captés (JSON : [{id, text, source}]) en attente d'import. */
  peekMessages(): string;
  /** Retire de la file native les messages dont les identifiants (JSON) ont été traités. */
  ackMessages(idsJson: string): void;
  openNotificationSettings(): void;
  requestSmsPermission(): void;
  /** JSON : { notifications: boolean, sms: boolean }. */
  status(): string;
}

declare global {
  interface Window {
    KpakpatoNative?: NativeBridge;
    __kpakpatoGoogleToken?: (token: string | null, error: string | null) => void;
    __kpakpatoNewMessage?: () => void;
  }
}

export interface NativeMessage {
  id: string;
  text: string;
}

export const isNativeApp = (): boolean => typeof window !== "undefined" && Boolean(window.KpakpatoNative);

/** Connexion Google faite par Android (Google refuse la connexion dans une WebView) : renvoie un jeton d'identité. */
export function nativeGoogleToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.KpakpatoNative) {
      reject(new Error("Application Android indisponible."));
      return;
    }
    window.__kpakpatoGoogleToken = (token, error) => {
      window.__kpakpatoGoogleToken = undefined;
      if (token) resolve(token);
      else reject(new Error(error || "Connexion annulée."));
    };
    window.KpakpatoNative.googleSignIn();
  });
}

export function peekNativeMessages(): NativeMessage[] {
  try {
    const parsed = JSON.parse(window.KpakpatoNative?.peekMessages() ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((m): m is NativeMessage => typeof m?.id === "string" && typeof m?.text === "string")
      : [];
  } catch {
    return [];
  }
}

export function ackNativeMessages(ids: string[]) {
  try {
    window.KpakpatoNative?.ackMessages(JSON.stringify(ids));
  } catch {
    // le message restera en file et sera retraité (les doublons sont ignorés à l'import)
  }
}

export function nativeStatus(): { notifications: boolean; sms: boolean } | null {
  try {
    const s = JSON.parse(window.KpakpatoNative?.status() ?? "null");
    return s ? { notifications: Boolean(s.notifications), sms: Boolean(s.sms) } : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

/** Prévenu quand Android capte un nouveau message alors que l'app est ouverte. */
export function onNativeMessage(listener: () => void): () => void {
  listeners.add(listener);
  window.__kpakpatoNewMessage = () => listeners.forEach((l) => l());
  return () => {
    listeners.delete(listener);
  };
}
