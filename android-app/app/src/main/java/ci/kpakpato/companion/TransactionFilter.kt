package ci.kpakpato.companion

/**
 * Ne laisse passer que les textes qui ressemblent à une transaction Mobile Money :
 * un montant en FCFA et un mot d'opération. Les autres messages (conversations, publicités)
 * ne quittent jamais le téléphone.
 */
object TransactionFilter {
    private val amount = Regex("""\d[\d\s.,]*\s?(F\s?CFA|FCFA|XOF|F\b)""", RegexOption.IGNORE_CASE)
    private val keywords = Regex(
        """(envoy|re[çc]u|d[ée]bit|cr[ée]dit|paiement|pay[ée]|transfert|retrait|d[ée]p[ôo]t|solde|achat|facture|frais)""",
        RegexOption.IGNORE_CASE,
    )
    private val brands = Regex("""(wave|orange|\bom\b|mtn|momo|moov|djamo)""", RegexOption.IGNORE_CASE)

    private const val MAX_LENGTH = 2000

    fun looksLikeTransaction(text: String): Boolean =
        text.length in 15..MAX_LENGTH && amount.containsMatchIn(text) && keywords.containsMatchIn(text)

    /** Ajoute l'expéditeur du SMS quand le texte ne nomme pas l'opérateur (aide à choisir le portefeuille). */
    fun withSender(sender: String?, body: String): String {
        if (sender.isNullOrBlank() || brands.containsMatchIn(body) || !brands.containsMatchIn(sender)) return body
        return "$body\n($sender)"
    }
}
