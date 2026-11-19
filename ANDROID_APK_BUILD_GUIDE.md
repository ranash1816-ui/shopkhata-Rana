# Shopkhata BD — Android APK Build Guide

This package contains the complete source code for **Shopkhata BD** (Offline-First PWA & Shop Management App).

## Quick Start (Web / PWA)
1. Install Node.js 20+
2. Run:
   ```bash
   npm install
   npm run build
   npm start
   ```

## Build an Installable Android Debug APK (using Capacitor)
Requires **Node.js 20+**, **Java JDK 17+**, and **Android Studio / Android SDK**:

```bash
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Shopkhata BD" com.shopkhata.bd --web-dir=dist
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
```

The compiled debug APK will be generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`
