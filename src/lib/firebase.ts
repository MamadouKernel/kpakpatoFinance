import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "your_firebase_api_key" &&
    firebaseConfig.projectId
);

/**
 * Firestore avec cache local persistant (IndexedDB) : l'app reste utilisable sans réseau,
 * les écritures faites hors ligne partent d'elles-mêmes au retour de la connexion.
 */
function createFirestore(firebaseApp: FirebaseApp): Firestore {
  if (typeof window !== "undefined") {
    try {
      return initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      // Déjà initialisé (rechargement à chaud) ou IndexedDB indisponible : cache en mémoire.
    }
  }
  return getFirestore(firebaseApp);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = createFirestore(app);
    googleProvider = new GoogleAuthProvider();
    // Plusieurs comptes Gmail sur le même téléphone : on laisse toujours choisir le compte.
    googleProvider.setCustomParameters({ prompt: "select_account" });
  } catch (error) {
    console.warn("Firebase initialization skipped (mode démo local actif):", error);
  }
}

export { app, auth, db, googleProvider };
