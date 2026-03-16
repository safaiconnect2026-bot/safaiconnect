# Safai Connect — Mobile Build Guide

> This section is dedicated to the Android mobile build. All steps below apply only to the Android APK.

## Overview
The Android app wraps the Safai Connect web app using **Capacitor 8**.
App ID: `com.safaiconnect.app`

---

## Prerequisites
- [Android Studio](https://developer.android.com/studio) (latest stable — Ladybug or newer)
- JDK 17+ (bundled with Android Studio, no separate install needed)
- Android SDK 34 (install via Android Studio → SDK Manager)
- USB debugging enabled on your test device, OR an Android emulator configured

---

## Build Steps

### Step 1 — Build the web app
```bash
npm run build
```
This compiles TypeScript and builds the Vite production bundle into `dist/`.

### Step 2 — Sync to Android
```bash
npx cap sync android
```
Copies `dist/` into `android/app/src/main/assets/public/` and syncs all Capacitor plugin native code.

### Step 3 — Open in Android Studio
```bash
npx cap open android
```
Android Studio opens the `android/` folder as a Gradle project.
Wait for **Gradle sync** to complete (shown in the bottom status bar). First sync takes 1–3 min.

### Step 4 — Build Debug APK (for testing)
In Android Studio:
**Build → Build Bundle(s)/APK(s) → Build APK(s)**

Output path: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 5 — Install on device
```bash
# Connect your Android device via USB with USB debugging ON
adb install android/app/build/outputs/apk/debug/app-debug.apk
```
Or press the **Run ▶** button in Android Studio with your device selected.

### Step 6 — Build Release APK (for distribution / Play Store)
In Android Studio:
**Build → Generate Signed Bundle/APK → APK**
- Create or select your keystore file
- Build type: **Release**
- Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Updating the App After Code Changes
```bash
npm run build && npx cap sync android
```
Then rebuild in Android Studio (or use Run ▶ to deploy directly to device).

---

## Capacitor Plugins
| Plugin | Purpose |
|--------|---------|
| `@capacitor/camera` | Photo capture — complaint photos, work evidence |
| `@capacitor/geolocation` | GPS tagging on complaint photos |
| `@capacitor/core` | Core bridge between web and native Android |

---

## Android Permissions
| Permission | Why it's needed |
|-----------|----------------|
| `CAMERA` | Take photos for complaints and work evidence |
| `ACCESS_FINE_LOCATION` | GPS tagging on complaint photos |
| `ACCESS_COARSE_LOCATION` | Fallback location for GPS tagging |
| `READ_EXTERNAL_STORAGE` | Access photos from gallery (Android ≤ 12) |
| `WRITE_EXTERNAL_STORAGE` | Save captured photos (Android ≤ 9) |
| `INTERNET` | Firebase Auth, Firestore, Storage connections |
| `ACCESS_NETWORK_STATE` | Detect offline mode |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Gradle sync fails | Android Studio → File → Invalidate Caches & Restart |
| Firebase fails on device | Verify `androidScheme: 'https'` in `capacitor.config.ts` |
| Camera not working | Settings → Apps → Safai Connect → Permissions → Allow Camera |
| GPS not working | Settings → Apps → Safai Connect → Permissions → Allow Location |
| "SDK not found" build error | Android Studio → SDK Manager → Install Android 14 (API 34) |
| App shows blank screen | Check USB debugging is on; try `adb logcat` for JS errors |
| Node version warning | Capacitor CLI requires Node 22+; update Node if you see engine errors |

---

## App Details
| Field | Value |
|-------|-------|
| App ID | `com.safaiconnect.app` |
| App Name | Safai Connect |
| Min SDK | 22 (Android 5.1) |
| Target SDK | 34 (Android 14) |
| Architecture | Web (React/Vite) wrapped in Capacitor WebView |
