package ci.kpakpato.companion

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** Capte les notifications qui ressemblent à une transaction Mobile Money. */
class NotificationCaptureService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName == packageName) return
        val extras = sbn.notification.extras
        // Les résumés de groupe répètent les notifications individuelles.
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
        val text = listOf(title, body).filter { it.isNotBlank() }.joinToString("\n").trim()

        if (TransactionFilter.looksLikeTransaction(text)) {
            MessageStore.add(applicationContext, text, "notification:${sbn.packageName}")
        }
    }
}
