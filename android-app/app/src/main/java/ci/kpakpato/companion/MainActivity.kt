package ci.kpakpato.companion

import android.Manifest
import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.lifecycle.lifecycleScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Kpakpato Finance en application Android : la plateforme web dans une WebView, plus la capture
 * des notifications et SMS de transaction, transmise à la plateforme par le pont `KpakpatoNative`.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private val appHost: String = Uri.parse(BuildConfig.APP_URL).host.orEmpty()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                // Le pont n'est exposé qu'à la plateforme : tout autre site s'ouvre dans le navigateur.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (request.url.host == appHost) return false
                    startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    return true
                }
            }
            addJavascriptInterface(Bridge(), "KpakpatoNative")
        }
        setContentView(web)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })

        if (savedInstanceState == null) web.loadUrl(BuildConfig.APP_URL) else web.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        // Réveille la plateforme : de nouveaux messages ont pu arriver pendant que l'app était fermée.
        MessageStore.onNewMessage = { runOnUiThread { js("window.__kpakpatoNewMessage && window.__kpakpatoNewMessage()") } }
        js("window.__kpakpatoNewMessage && window.__kpakpatoNewMessage()")
    }

    override fun onPause() {
        super.onPause()
        MessageStore.onNewMessage = null
    }

    private fun js(code: String) {
        if (::web.isInitialized) web.evaluateJavascript(code, null)
    }

    private fun quote(value: String?): String = JSONObject.quote(value ?: "")

    private fun signIn() {
        lifecycleScope.launch {
            try {
                val webClientId = getString(resources.getIdentifier("default_web_client_id", "string", packageName))
                val option = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(webClientId)
                    .build()
                val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                val credential = CredentialManager.create(this@MainActivity)
                    .getCredential(this@MainActivity, request).credential
                if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    val token = GoogleIdTokenCredential.createFrom(credential.data).idToken
                    js("window.__kpakpatoGoogleToken && window.__kpakpatoGoogleToken(${quote(token)}, null)")
                } else {
                    js("window.__kpakpatoGoogleToken && window.__kpakpatoGoogleToken(null, 'Connexion Google impossible.')")
                }
            } catch (e: Exception) {
                js("window.__kpakpatoGoogleToken && window.__kpakpatoGoogleToken(null, ${quote(e.message ?: "Connexion annulée.")})")
            }
        }
    }

    /** Fonctions appelables par la plateforme web (window.KpakpatoNative). */
    inner class Bridge {
        @JavascriptInterface
        fun googleSignIn() {
            runOnUiThread { signIn() }
        }

        @JavascriptInterface
        fun peekMessages(): String = MessageStore.peek(applicationContext)

        @JavascriptInterface
        fun ackMessages(idsJson: String) {
            val ids = try {
                val array = JSONArray(idsJson)
                (0 until array.length()).map { array.getString(it) }.toSet()
            } catch (e: Exception) {
                emptySet()
            }
            MessageStore.ack(applicationContext, ids)
        }

        @JavascriptInterface
        fun openNotificationSettings() {
            runOnUiThread { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        }

        @JavascriptInterface
        fun requestSmsPermission() {
            runOnUiThread {
                ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.RECEIVE_SMS), 1)
            }
        }

        @JavascriptInterface
        fun status(): String {
            val listener = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
                ?.contains(ComponentName(this@MainActivity, NotificationCaptureService::class.java).flattenToString()) == true
            val sms = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECEIVE_SMS) ==
                PackageManager.PERMISSION_GRANTED
            return JSONObject().put("notifications", listener).put("sms", sms).toString()
        }
    }
}
