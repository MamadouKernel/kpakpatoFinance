# Kpakpato Compagnon (Android)

Petite app Android qui lit les **notifications** et les **SMS** de transaction (Wave, Orange Money, MTN, Moov, Djamo)
et les dépose dans votre compte Kpakpato Finance. L'app web les importe (mêmes règles que « Importer SMS »)
dès que vous l'ouvrez.

```
Téléphone                          Firebase                       Kpakpato Finance (web)
notification / SMS  ──►  users/{uid}/inbox/{id}  ──►  CompanionInbox : analyse, importe, vide la boîte
```

- Seuls les textes qui contiennent **un montant en FCFA et un mot d'opération** (envoi, reçu, débit, solde…) sont envoyés.
- Rien n'est envoyé ailleurs que dans **votre** document Firestore (les règles n'autorisent que vous).
- Cas sûrs : importés automatiquement. Cas incertains (portefeuille non reconnu) : à confirmer dans « Importer SMS ».
- Android uniquement : iOS interdit la lecture des notifications d'autres apps.

> Ce projet n'a pas pu être compilé ni essayé sur un téléphone par son auteur : prévoyez de petits ajustements au premier essai.

## Installation (une seule fois)

1. **Firebase** : console Firebase → Paramètres du projet → *Ajouter une application* → **Android**.
   - Nom du package : `ci.kpakpato.companion`
   - Empreinte SHA-1 : celle de votre clé de debug (voir plus bas).
   - Téléchargez `google-services.json` et placez-le dans `android-companion/app/` (fichier ignoré par git).
   - Dans *Authentication → Sign-in method*, Google doit déjà être activé (c'est le cas pour la web app).
2. **Règles Firestore** : republiez `firestore.rules` (elles contiennent maintenant `users/{uid}/inbox`).
3. **Android Studio** (Koala ou plus récent) → *Open* → dossier `android-companion/` → laissez Gradle se synchroniser
   (il crée le wrapper Gradle tout seul).
4. Branchez le téléphone (mode développeur + débogage USB) puis *Run*, ou *Build → Build APK(s)* et copiez l'APK sur le téléphone.

SHA-1 de debug :

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
```

## Utilisation

Ouvrez **Kpakpato Compagnon** puis :

1. *Se connecter avec Google* (même compte que Kpakpato Finance).
2. *Autoriser l'accès aux notifications* : activez « Kpakpato Compagnon » dans la liste.
3. *Autoriser la lecture des SMS* : acceptez la permission.

L'écran indique ✔ pour chaque étape et compte les messages envoyés.

## Points d'attention

- **Économiseur de batterie** : sur certains téléphones (Tecno, Infinix, Xiaomi…), excluez l'app des optimisations
  de batterie, sinon Android peut arrêter la lecture des notifications en arrière-plan.
- **Doublons** : un même paiement peut arriver par notification **et** par SMS. L'app web ignore les doublons quand
  le texte contient l'identifiant de transaction.
- **Google Play** : Google restreint la permission SMS. L'installation par APK n'est pas concernée.
- **Import côté web** : l'écriture dans la boîte est immédiate, mais l'import dans vos portefeuilles se fait quand
  Kpakpato Finance est ouverte (le toast « Transaction importée depuis votre téléphone » l'indique).

## Proposer le téléchargement depuis la plateforme

La fenêtre « Connecter mon téléphone » de Kpakpato Finance affiche un bouton de téléchargement dès que le fichier
`public/kpakpato-compagnon.apk` existe. Après avoir construit l'APK (signé avec votre clé de publication, dont le
SHA-1 est enregistré dans Firebase), copiez-le sous ce nom dans `public/`, commitez et poussez : Vercel le servira.
