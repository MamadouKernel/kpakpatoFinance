package ci.kpakpato.companion

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/** Capte les SMS entrants qui ressemblent à une transaction Mobile Money. */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

        // Un SMS long arrive en plusieurs morceaux : on les recolle par expéditeur.
        messages.groupBy { it.originatingAddress }.forEach { (sender, parts) ->
            val body = parts.joinToString("") { it.messageBody.orEmpty() }.trim()
            if (TransactionFilter.looksLikeTransaction(body)) {
                InboxUploader.submit(context.applicationContext, TransactionFilter.withSender(sender, body), "sms")
            }
        }
    }
}
