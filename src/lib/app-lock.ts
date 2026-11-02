/**
 * Verrouillage de l'app sur l'appareil : code à 4-6 chiffres et, si le téléphone le permet,
 * empreinte ou visage (WebAuthn, authentificateur de l'appareil). C'est un verrou local :
 * il protège l'écran contre quelqu'un qui prend le téléphone, pas le compte Google.
 */

const PIN_MIN = 4;
const PIN_MAX = 6;
const MAX_FAILS = 5;
const LOCKOUT_MS = 30_000;
const ITERATIONS = 150_000;

interface LockData {
  salt: string;
  hash: string;
  /** Identifiant de la clé biométrique (base64) si l'empreinte / le visage est activé. */
  cred?: string;
  fails?: number;
  until?: number;
}

const lockKey = (uid: string) => `kpakpato_lock_v1_${uid}`;
const skipKey = (uid: string) => `kpakpato_lock_skip_v1_${uid}`;

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};
const fromB64 = (b64: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function read(uid: string): LockData | null {
  try {
    const raw = localStorage.getItem(lockKey(uid));
    if (!raw) return null;
    const d = JSON.parse(raw);
    return typeof d?.salt === "string" && typeof d?.hash === "string" ? (d as LockData) : null;
  } catch {
    return null;
  }
}

function write(uid: string, data: LockData) {
  try {
    localStorage.setItem(lockKey(uid), JSON.stringify(data));
  } catch {
    // stockage indisponible : le verrou ne sera pas actif
  }
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return toB64(bits);
}

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);
export const PIN_LENGTH = { min: PIN_MIN, max: PIN_MAX };

export const hasLock = (uid: string) => read(uid) !== null;
export const hasBiometric = (uid: string) => Boolean(read(uid)?.cred);
export const lockPromptSkipped = (uid: string) => {
  try {
    return localStorage.getItem(skipKey(uid)) === "1";
  } catch {
    return true;
  }
};
export const skipLockPrompt = (uid: string) => {
  try {
    localStorage.setItem(skipKey(uid), "1");
  } catch {
    // ignoré
  }
};

export async function setPin(uid: string, pin: string) {
  if (!isValidPin(pin)) throw new Error(`Le code doit faire ${PIN_MIN} à ${PIN_MAX} chiffres.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const previous = read(uid);
  write(uid, { salt: toB64(salt), hash: await derive(pin, salt), cred: previous?.cred });
}

export function removeLock(uid: string) {
  try {
    localStorage.removeItem(lockKey(uid));
  } catch {
    // ignoré
  }
}

/** Renvoie « ok », « wrong » ou le nombre de secondes d'attente restantes. */
export async function verifyPin(uid: string, pin: string): Promise<"ok" | "wrong" | { wait: number }> {
  const data = read(uid);
  if (!data) return "ok";
  const now = Date.now();
  if (data.until && data.until > now) return { wait: Math.ceil((data.until - now) / 1000) };
  const hash = await derive(pin, fromB64(data.salt));
  if (hash === data.hash) {
    write(uid, { ...data, fails: 0, until: undefined });
    return "ok";
  }
  const fails = (data.fails ?? 0) + 1;
  if (fails >= MAX_FAILS) {
    write(uid, { ...data, fails: 0, until: now + LOCKOUT_MS });
    return { wait: LOCKOUT_MS / 1000 };
  }
  write(uid, { ...data, fails });
  return "wrong";
}

export async function biometricSupported(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function enableBiometric(uid: string, label: string) {
  const data = read(uid);
  if (!data) throw new Error("Définissez d'abord un code.");
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "Kpakpato Finance" },
      user: { id: new TextEncoder().encode(uid), name: label || uid, displayName: label || "Kpakpato" },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "discouraged",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Activation annulée.");
  write(uid, { ...data, cred: toB64(cred.rawId) });
}

export function disableBiometric(uid: string) {
  const data = read(uid);
  if (data) write(uid, { ...data, cred: undefined });
}

/** Demande l'empreinte ou le visage. Renvoie false si l'utilisateur annule ou si ça échoue. */
export async function unlockWithBiometric(uid: string): Promise<boolean> {
  const data = read(uid);
  if (!data?.cred) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: fromB64(data.cred), transports: ["internal"] }],
        userVerification: "required",
        timeout: 60_000,
      },
    });
    return Boolean(res);
  } catch {
    return false;
  }
}
