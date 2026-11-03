#!/usr/bin/env bash
# Construit l'APK Android de Kpakpato Finance.
#   ./android-app/build.sh debug     -> android-app/kpakpato-debug.apk   (essai sur votre téléphone, clé de test)
#   ./android-app/build.sh release   -> android-app/kpakpato-release.apk (APK à publier, signé avec keystore.properties)
#   ./android-app/build.sh install   -> construit le debug puis l'installe par câble USB (adb)
set -euo pipefail

cd "$(dirname "$0")"
MODE="${1:-debug}"

# Réglages de la machine de développement (modifiables par variables d'environnement).
export JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk17}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:--Djava.net.preferIPv4Stack=true}"
GRADLE="${GRADLE:-}"
if [ -z "$GRADLE" ]; then
  if [ -x "$HOME/Android/gradle-8.7/bin/gradle" ]; then GRADLE="$HOME/Android/gradle-8.7/bin/gradle"; else GRADLE="./gradlew"; fi
fi
[ -f app/google-services.json ] || { echo "app/google-services.json manquant : téléchargez-le depuis Firebase (voir README)." >&2; exit 1; }
[ -f local.properties ] || echo "sdk.dir=$ANDROID_HOME" > local.properties

case "$MODE" in
  debug|install)
    "$GRADLE" assembleDirectDebug --no-daemon
    cp app/build/outputs/apk/direct/debug/app-direct-debug.apk kpakpato-debug.apk
    echo "APK prêt : android-app/kpakpato-debug.apk"
    if [ "$MODE" = "install" ]; then
      ADB="$ANDROID_HOME/platform-tools/adb"
      [ -x "$ADB" ] || ADB="$(command -v adb || true)"
      [ -n "$ADB" ] || { echo "adb introuvable : installez les platform-tools Android ou copiez l'APK sur le téléphone." >&2; exit 1; }
      "$ADB" install -r kpakpato-debug.apk
    fi
    ;;
  release)
    [ -f keystore.properties ] || { echo "keystore.properties manquant (voir README)." >&2; exit 1; }
    "$GRADLE" assembleDirectRelease --no-daemon
    cp app/build/outputs/apk/direct/release/app-direct-release.apk kpakpato-release.apk
    echo "APK prêt : android-app/kpakpato-release.apk"
    ;;
  *)
    echo "Usage : $0 debug|release|install" >&2
    exit 1
    ;;
esac
