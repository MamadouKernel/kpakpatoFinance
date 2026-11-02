package ci.kpakpato.companion

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.lifecycle.lifecycleScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/** Écran unique : connexion Google, deux autorisations, et l'état de la capture. */
class MainActivity : ComponentActivity() {

    private lateinit var status: TextView
    private lateinit var account: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        fun title(text: String) = TextView(this).apply {
            this.text = text
            textSize = 22f
            setPadding(0, 0, 0, 16)
        }

        fun button(label: String, action: () -> Unit) = Button(this).apply {
            text = label
            isAllCaps = false
            setOnClickListener { action() }
        }

        account = TextView(this).apply { setPadding(0, 16, 0, 16) }
        status = TextView(this).apply { setPadding(0, 24, 0, 0) }

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 64, 48, 48)
            addView(title("Kpakpato Compagnon"))
            addView(TextView(context).apply {
                text = "Envoie vos notifications et SMS de transaction (Wave, Orange Money…) vers Kpakpato Finance. " +
                    "Seuls les messages qui contiennent un montant en FCFA et un mot d'opération sont envoyés."
            })
            addView(account)
            addView(button("1. Se connecter avec Google") { signIn() })
            addView(button("2. Autoriser l'accès aux notifications") {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            })
            addView(button("3. Autoriser la lecture des SMS") {
                ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.RECEIVE_SMS), 1)
            })
            addView(status)
        }
        setContentView(ScrollView(this).apply { addView(column) })
    }

    override fun onResume() {
        super.onResume()
        InboxUploader.flushPending(applicationContext)
        refresh()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refresh()
    }

    private fun signIn() {
        lifecycleScope.launch {
            try {
                val option = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(getString(resources.getIdentifier("default_web_client_id", "string", packageName)))
                    .build()
                val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                val credential = CredentialManager.create(this@MainActivity).getCredential(this@MainActivity, request).credential
                if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
                    FirebaseAuth.getInstance().signInWithCredential(GoogleAuthProvider.getCredential(token, null)).await()
                    InboxUploader.flushPending(applicationContext)
                }
            } catch (e: Exception) {
                account.text = "Connexion impossible : ${e.message}"
                return@launch
            }
            refresh()
        }
    }

    private fun refresh() {
        val user = FirebaseAuth.getInstance().currentUser
        account.text = if (user != null) "Connecté : ${user.email}" else "Non connecté"

        val listenerOn = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
            ?.contains(ComponentName(this, NotificationCaptureService::class.java).flattenToString()) == true
        val smsOn = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED

        status.text = buildString {
            appendLine(if (user != null) "✔ Compte connecté" else "✘ Compte non connecté")
            appendLine(if (listenerOn) "✔ Notifications autorisées" else "✘ Notifications non autorisées")
            appendLine(if (smsOn) "✔ SMS autorisés" else "✘ SMS non autorisés")
            append("Messages envoyés à Kpakpato : ${InboxUploader.sentCount(this@MainActivity)}")
        }
    }
}
