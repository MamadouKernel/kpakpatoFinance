import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Kpakpato Finance",
  description: "Quelles données Kpakpato Finance utilise, pourquoi, et comment les supprimer.",
};

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const h2 = "mt-8 text-lg font-extrabold text-white";
const p = "mt-2 text-sm leading-relaxed text-slate-300";
const li = "mt-1.5 text-sm leading-relaxed text-slate-300";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-extrabold text-white">
        Politique de confidentialité <span className="text-kpakpato-orange">Kpakpato Finance</span>
      </h1>
      <p className={p}>
        Kpakpato Finance est une application de suivi de finances personnelles (FCFA). Cette page explique, simplement,
        quelles données elle utilise et ce qu&apos;elle en fait. Dernière mise à jour : novembre 2026.
      </p>

      <h2 className={h2}>1. Les données utilisées</h2>
      <ul className="mt-2 list-disc pl-5">
        <li className={li}>
          <strong className="text-white">Votre compte Google</strong> : nom, adresse e-mail et identifiant, pour vous connecter
          et retrouver vos données sur tous vos appareils.
        </li>
        <li className={li}>
          <strong className="text-white">Vos données financières</strong> : portefeuilles, soldes, opérations, tontines,
          budgets et profil que vous saisissez ou importez.
        </li>
        <li className={li}>
          <strong className="text-white">Les notifications et SMS de transaction</strong> (application Android) : voir le point 2.
        </li>
        <li className={li}>
          <strong className="text-white">Votre code de verrouillage</strong> : seule une empreinte chiffrée du code est conservée,
          jamais le code lui-même. L&apos;empreinte digitale ou le visage ne quittent jamais votre téléphone.
        </li>
        <li className={li}>
          <strong className="text-white">Les informations du foyer</strong>, si vous utilisez l&apos;Espace Couple : le nom, le
          genre et les soldes que vous partagez avec la personne liée à votre compte.
        </li>
      </ul>

      <h2 className={h2}>2. Notifications et SMS (application Android)</h2>
      <p className={p}>
        Avec votre accord explicite, l&apos;application Android lit les notifications reçues sur votre téléphone (et, dans la
        version téléchargée depuis le site, les SMS) afin d&apos;enregistrer automatiquement vos transactions Mobile Money (Wave,
        Orange Money, MTN, Moov, Djamo).
      </p>
      <ul className="mt-2 list-disc pl-5">
        <li className={li}>
          Seuls les messages qui ressemblent à une transaction (un montant en FCFA et un mot comme reçu, envoyé, paiement,
          retrait) sont retenus. Tous les autres sont ignorés et ne quittent jamais votre téléphone.
        </li>
        <li className={li}>Les messages retenus servent uniquement à créer vos opérations dans votre compte Kpakpato.</li>
        <li className={li}>Vous pouvez retirer cet accès à tout moment dans les réglages d&apos;Android.</li>
      </ul>

      <h2 className={h2}>3. Ce que nous n&apos;en faisons pas</h2>
      <ul className="mt-2 list-disc pl-5">
        <li className={li}>Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité.</li>
        <li className={li}>Nous ne les partageons pas avec des tiers, sauf les prestataires techniques listés ci-dessous.</li>
        <li className={li}>L&apos;application ne déplace jamais d&apos;argent : elle n&apos;a aucun accès à vos comptes Mobile Money.</li>
      </ul>

      <h2 className={h2}>4. Prestataires techniques</h2>
      <ul className="mt-2 list-disc pl-5">
        <li className={li}>
          <strong className="text-white">Google Firebase</strong> (authentification et base de données) : stocke votre compte et
          vos données financières.
        </li>
        <li className={li}>
          <strong className="text-white">Vercel</strong> : héberge le site et conserve les journaux techniques habituels
          (adresse IP, date de requête).
        </li>
        <li className={li}>
          <strong className="text-white">Google Gemini</strong> (conseiller financier IA) : quand vous posez une question au
          conseiller, un résumé de vos soldes et de vos dernières opérations est envoyé à ce service pour produire la réponse.
          Rien n&apos;est envoyé si vous n&apos;utilisez pas le conseiller.
        </li>
      </ul>

      <h2 className={h2}>5. Conservation et suppression</h2>
      <p className={p}>
        Vos données sont conservées tant que votre compte existe. Vous pouvez supprimer votre compte et toutes vos données à tout
        moment, directement dans l&apos;application : ouvrez votre profil (icône de personne en haut), puis « Supprimer mon
        compte ». Vos portefeuilles, opérations, tontines, profil et compte de connexion sont alors effacés définitivement. Si
        vous ne pouvez plus ouvrir l&apos;application, écrivez-nous (voir ci-dessous) depuis l&apos;adresse e-mail de votre
        compte. Vous pouvez aussi retirer vous-même vos opérations et portefeuilles.
      </p>

      <h2 className={h2}>6. Sécurité</h2>
      <p className={p}>
        Les échanges sont chiffrés (HTTPS). Chaque utilisateur ne peut lire que ses propres données ; l&apos;Espace Couple ne
        partage que ce que vous choisissez avec la personne liée à votre compte. Le verrouillage par code ou empreinte protège
        l&apos;accès à l&apos;application sur votre téléphone.
      </p>

      <h2 className={h2}>7. Contact</h2>
      <p className={p}>
        {CONTACT ? (
          <>
            Pour toute question ou demande (accès, correction, suppression) :{" "}
            <a className="text-kpakpato-orange underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </>
        ) : (
          "Pour toute question ou demande (accès, correction, suppression), contactez l'éditeur de l'application par le canal par lequel vous l'avez reçue."
        )}
      </p>
    </main>
  );
}
