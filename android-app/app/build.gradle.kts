import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

// Adresse de la plateforme chargée par l'app (modifiable dans gradle.properties).
val appUrl: String = (project.findProperty("kpakpatoAppUrl") as String?) ?: "https://kpakpato-finance.vercel.app"

// Le Play Store exige de cibler une version d'Android récente : à relever (gradle.properties) une fois la plateforme installée.
val targetSdkVersion: Int = ((project.findProperty("kpakpatoTargetSdk") as String?) ?: "34").toInt()

android {
    namespace = "ci.kpakpato.companion"
    compileSdk = targetSdkVersion

    defaultConfig {
        applicationId = "ci.kpakpato.companion"
        minSdk = 26
        targetSdk = targetSdkVersion
        versionCode = 1
        versionName = "1.0"
        buildConfigField("String", "APP_URL", "\"$appUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    // Deux variantes : « direct » (téléchargée depuis le site, lit aussi les SMS) et « play »
    // (Play Store : Google réserve la lecture des SMS aux applications de messagerie, donc notifications seulement).
    flavorDimensions += "dist"
    productFlavors {
        create("direct") {
            dimension = "dist"
            buildConfigField("boolean", "SMS_ENABLED", "true")
        }
        create("play") {
            dimension = "dist"
            buildConfigField("boolean", "SMS_ENABLED", "false")
        }
    }

    // Clé de publication : créez-la une fois (voir README) et renseignez keystore.properties.
    val keystoreFile = rootProject.file("keystore.properties")
    if (keystoreFile.exists()) {
        val props = Properties().apply { keystoreFile.inputStream().use { load(it) } }
        signingConfigs {
            create("release") {
                storeFile = rootProject.file(props.getProperty("storeFile"))
                storePassword = props.getProperty("storePassword")
                keyAlias = props.getProperty("keyAlias")
                keyPassword = props.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (keystoreFile.exists()) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")

    // Génère default_web_client_id à partir de google-services.json (utilisé pour la connexion Google).
    implementation(platform("com.google.firebase:firebase-bom:33.3.0"))
    implementation("com.google.firebase:firebase-auth")

    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
}
