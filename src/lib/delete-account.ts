import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { deleteUser, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";
import { isNativeApp, nativeGoogleToken } from "@/lib/native-bridge";
import { removeLock } from "@/lib/app-lock";

/**
 * Supprime le compte Kpakpato : données financières, boîte de réception, profil, puis compte de connexion.
 * La confirmation Google vient en premier : si elle échoue, rien n'a encore été supprimé.
 * `leaveHousehold` met fin au foyer (Espace Couple) avant la suppression.
 */
export async function deleteMyAccount(hasHousehold: boolean, leaveHousehold: () => Promise<void>) {
  const user = auth?.currentUser;
  if (!auth || !db || !user || !googleProvider) throw new Error("Connectez-vous pour supprimer votre compte.");

  // Suppression d'un compte : Google redemande une connexion récente.
  if (isNativeApp()) {
    const token = await nativeGoogleToken();
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(token));
  } else {
    await reauthenticateWithPopup(user, googleProvider);
  }

  if (hasHousehold) await leaveHousehold();

  const inbox = await getDocs(collection(db, "users", user.uid, "inbox")).catch(() => null);
  if (inbox) await Promise.all(inbox.docs.map((d) => deleteDoc(d.ref).catch(() => undefined)));
  await deleteDoc(doc(db, "users", user.uid));

  removeLock(user.uid);
  await deleteUser(user);
}
