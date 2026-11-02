package ci.kpakpato.companion

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/**
 * File locale des textes captés (notifications et SMS) en attente d'import par la plateforme web.
 * Rien ne quitte le téléphone ici : la plateforme les relit via le pont JavaScript puis les retire.
 */
object MessageStore {
    private const val PREFS = "kpakpato_messages"
    private const val KEY = "queue"
    private const val MAX = 300

    /** Appelé quand un message arrive alors que l'app est ouverte, pour réveiller la plateforme. */
    @Volatile
    var onNewMessage: (() -> Unit)? = null

    @Synchronized
    fun add(context: Context, text: String, source: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val queue = read(prefs.getString(KEY, null))
        // Même texte déjà en attente (notification reçue deux fois) : une seule entrée.
        val id = sha256(text).take(24)
        for (i in 0 until queue.length()) if (queue.getJSONObject(i).optString("id") == id) return
        queue.put(JSONObject().put("id", id).put("text", text).put("source", source).put("at", System.currentTimeMillis()))
        val trimmed = if (queue.length() > MAX) JSONArray((queue.length() - MAX until queue.length()).map { queue.get(it) }) else queue
        prefs.edit().putString(KEY, trimmed.toString()).apply()
        onNewMessage?.invoke()
    }

    @Synchronized
    fun peek(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null) ?: "[]"

    @Synchronized
    fun ack(context: Context, ids: Set<String>) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val queue = read(prefs.getString(KEY, null))
        val kept = JSONArray()
        for (i in 0 until queue.length()) {
            val item = queue.getJSONObject(i)
            if (item.optString("id") !in ids) kept.put(item)
        }
        prefs.edit().putString(KEY, kept.toString()).apply()
    }

    private fun read(raw: String?): JSONArray = try {
        JSONArray(raw ?: "[]")
    } catch (e: Exception) {
        JSONArray()
    }

    private fun sha256(text: String): String =
        MessageDigest.getInstance("SHA-256").digest(text.toByteArray()).joinToString("") { "%02x".format(it) }
}
