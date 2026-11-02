package ci.kpakpato.companion

import android.content.Context
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import java.security.MessageDigest

/**
 * Dépose le texte capté dans users/{uid}/inbox : l'app Kpakpato Finance l'importe à son prochain
 * affichage. Hors ligne, Firestore garde l'écriture et l'envoie au retour du réseau.
 * Si le compte n'est pas encore connecté, le texte attend dans un petit stock local.
 */
object InboxUploader {
    private const val PREFS = "kpakpato_companion"
    private const val PENDING = "pending"
    private const val SENT = "sent_count"

    fun submit(context: Context, text: String, source: String) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid
        if (uid == null) {
            stash(context, text, source)
            return
        }
        send(context, uid, text, source)
    }

    /** Envoie ce qui attendait la connexion. */
    fun flushPending(context: Context) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val items = prefs.getStringSet(PENDING, emptySet()).orEmpty()
        if (items.isEmpty()) return
        prefs.edit().remove(PENDING).apply()
        for (raw in items) {
            val source = raw.substringBefore('\u0001')
            val text = raw.substringAfter('\u0001')
            send(context, uid, text, source)
        }
    }

    fun sentCount(context: Context): Int =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(SENT, 0)

    private fun send(context: Context, uid: String, text: String, source: String) {
        // Même texte = même identifiant : une notification reçue deux fois n'est déposée qu'une fois.
        val id = sha256(text).take(24)
        FirebaseFirestore.getInstance()
            .collection("users").document(uid)
            .collection("inbox").document(id)
            .set(mapOf("text" to text, "source" to source, "receivedAt" to Timestamp.now()))
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.edit().putInt(SENT, prefs.getInt(SENT, 0) + 1).apply()
    }

    private fun stash(context: Context, text: String, source: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val items = prefs.getStringSet(PENDING, emptySet()).orEmpty().toMutableSet()
        if (items.size < 200) items.add("$source\u0001$text")
        prefs.edit().putStringSet(PENDING, items).apply()
    }

    private fun sha256(text: String): String =
        MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }
}
