# Kpakpato Finance — app Android

La plateforme web **Kpakpato Finance** dans une application Android, avec en plus la **capture automatique**
des notifications et SMS de transaction (Wave, Orange Money, MTN, Moov, Djamo).

```
notification / SMS ──► file locale du téléphone ──► pont KpakpatoNative ──► plateforme web
                                                                              analyse, importe, vide la file
```

- Les transactions arrivent dans les portefeuilles **sans copier ni importer** : à l'ouverture de l'app (et en direct
  quand elle est ouverte), la plateforme relit la file, importe les cas sûrs et affiche « Transaction importée ».
  Les cas incertains (portefeuille non reconnu) sont à confirmer dans « Importer SMS ».
- Seuls les textes qui contiennent **un montant en FCFA et un mot d'opération** sont gardés. Ils restent sur le
  téléphone jusqu'à leur import dans **votre** compte.
- La connexion Google est faite par Android (Google refuse la connexion dans une WebView) puis transmise à la plateforme.
- Android uniquement : iOS interdit la lecture des notifications d'autres apps (les iPhone gardent la PWA).

> Ce projet n'a pas pu être compilé ni essayé sur un téléphone par son auteur : prévoyez de petits ajustements au premier essai.

## Prérequis (une seule fois)

1. **Firebase** : application Android `ci.kpakpato.companion` avec votre empreinte SHA-1, puis `google-services.json`
   placé dans `android-app/app/` (fichier ignoré par git). Google doit être activé dans *Authentication*.
2. **Android Studio** (Koala ou plus récent) → *Open* → dossier `android-app/`. Gradle se synchronise tout seul.
3. L'adresse de la plateforme est dans `gradle.properties` (`kpakpatoAppUrl`).

## Essayer sur votre téléphone

Branchez le téléphone (options développeur + débogage USB) puis *Run* dans Android Studio. Ouvrez l'app, connectez-vous,
puis dans l'en-tête appuyez sur l'icône de téléphone et autorisez les **notifications** et les **SMS**.

## Publier l'APK pour les utilisateurs

1. Créez une clé de publication, **une seule fois**, et gardez-la précieusement (sans elle, plus de mise à jour possible) :

   ```bash
   keytool -genkey -v -keystore kpakpato-release.jks -alias kpakpato -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Créez `android-app/keystore.properties` (ignoré par git) :

   ```
   storeFile=kpakpato-release.jks
   storePassword=...
   keyAlias=kpakpato
   keyPassword=...
   ```

3. Récupérez l'empreinte SHA-1 de cette clé (`keytool -J-Duser.language=en -list -v -keystore kpakpato-release.jks`)
   et ajoutez-la dans Firebase (Paramètres du projet → application Android → *Ajouter une empreinte*).
   Sans cela, la connexion Google échoue pour les utilisateurs.
4. *Build → Generate Signed Bundle / APK → APK → release*, ou en ligne de commande `./gradlew assembleRelease`.
5. Copiez l'APK sous le nom **`public/kpakpato.apk`** du projet web, commitez et poussez : la fenêtre
   « Importer depuis mon téléphone » proposera alors le téléchargement.

## Points d'attention

- **Économiseur de batterie** : sur Tecno, Infinix, Xiaomi…, excluez l'app des optimisations, sinon Android peut
  arrêter la lecture des notifications.
- **Doublons** : un paiement peut arriver par notification **et** par SMS. La plateforme ignore les doublons quand
  le texte contient l'identifiant de transaction.
- **Google Play** : Google restreint la permission SMS ; l'installation par APK n'est pas concernée.
- **Mises à jour de la plateforme** : l'app charge le site, donc elle est toujours à jour sans réinstaller.
  Réinstallez l'APK seulement quand ce dossier `android-app/` change.
