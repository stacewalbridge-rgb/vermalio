plugins { id("com.android.application") }

android {
    namespace = "com.vamalio.judgeai"
    compileSdk = 35

    signingConfigs {
        create("judgeTest") {
            storeFile = file("../judgeai-test.keystore")
            storePassword = "judgeaitest"
            keyAlias = "judgeai-test"
            keyPassword = "judgeaitest"
        }
    }

    defaultConfig {
        applicationId = "com.vamalio.judgeai.test"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("judgeTest")
        }
    }
}
