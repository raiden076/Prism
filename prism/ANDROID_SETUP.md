# PRISM Android Build Setup Guide

This guide walks you through setting up Android builds for PRISM using Tauri v2.

## Prerequisites

### 1. Install Android Studio & SDK

Download and install Android Studio:
- **URL**: https://developer.android.com/studio
- **Required Components**:
  - Android SDK Platform
  - Android SDK Platform-Tools
  - Android SDK Build-Tools
  - Android NDK (Native Development Kit)

### 2. Set Environment Variables

Add to your `~/.bashrc`, `~/.zshrc`, or `~/.bash_profile`:

```bash
# Android SDK
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export PATH="$ANDROID_HOME/emulator:$PATH"

# Android NDK (required for Tauri)
export NDK_HOME="$ANDROID_HOME/ndk/25.0.8775105"
```

**Note**: Adjust the NDK version number to match what you have installed.

### 3. Install Rust Android Targets

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### 4. Verify Installation

```bash
# Check Android SDK
echo $ANDROID_HOME
ls $ANDROID_HOME

# Check NDK
echo $NDK_HOME
ls $NDK_HOME

# Check Rust targets
rustup target list --installed | grep android
```

## Setup Steps

### Step 1: Configure API Keys

Before building, you MUST configure these keys:

1. **OTPLess Authentication** (in `prism-engine/wrangler.jsonc`):
   ```json
   "vars": {
     "OTPLESS_CLIENT_ID": "YOUR_OTPLESS_CLIENT_ID",
     "OTPLESS_CLIENT_SECRET": "YOUR_OTPLESS_CLIENT_SECRET"
   }
   ```

2. **Mappls API Key** (in `prism/src/routes/+layout.svelte`):
   ```html
   <script src="https://apis.mappls.com/advancedmaps/api/YOUR_MAPPLS_KEY/map_load?v=3.0"></script>
   ```

3. **Backend URL** (update for production):
   - `prism/src/lib/auth.ts` (Line 65)
   - `prism/src/lib/offline/sync.ts` (Line 53)
   
   Change from `http://localhost:8787` to your Cloudflare Worker URL.

### Step 2: Run Setup Script

```bash
cd prism
./scripts/setup-android.sh
```

This will:
- Check prerequisites
- Install dependencies
- Initialize the Android project

### Step 3: Initialize Android Project (Manual)

If the script doesn't work, run manually:

```bash
cd prism

# Install dependencies
bun install

# Initialize Android project
bun run tauri android init
```

This creates the Android project in `src-tauri/gen/android/`.

### Step 4: Configure Signing (Release Builds)

For release APKs, you need a signing key:

```bash
# Generate keystore (run once)
keytool -genkey -v -keystore prism-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias prism

# Move to safe location
mv prism-release-key.jks src-tauri/gen/android/app/
```

Update `src-tauri/gen/android/app/build.gradle.kts`:

```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("prism-release-key.jks")
            storePassword = "your-store-password"
            keyAlias = "prism"
            keyPassword = "your-key-password"
        }
    }
    
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

**⚠️ Never commit the keystore or passwords to git!**

## Build Commands

### Development Build (Testing)

```bash
# Build debug APK
bun run android:build

# Or run on connected device/emulator
bun run android:dev
```

### Release Build (Production)

```bash
# Build release APK (requires signing config)
bun run android:build:release

# Output location:
# src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk
```

### Build Specific Architectures

```bash
# Build only for ARM64 (most modern Android devices)
bun run tauri android build --target aarch64-linux-android

# Build for all architectures
bun run tauri android build --target aarch64-linux-android --target armv7-linux-androideabi
```

## Output Locations

After building, find your APKs at:

- **Debug**: `src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk`
- **Release**: `src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk`
- **Universal APK**: Contains all architectures (larger file)
- **Split APKs**: One per architecture (smaller files)

## Testing on Device

### Method 1: USB Debugging

1. Enable Developer Options on Android device
2. Enable USB Debugging
3. Connect via USB
4. Run: `bun run android:dev`

### Method 2: Install APK

```bash
# Install on connected device
adb install src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk

# Or copy APK to device and install manually
```

### Method 3: Android Emulator

```bash
# Start emulator
$ANDROID_HOME/emulator/emulator -avd <avd-name>

# Then run
bun run android:dev
```

## Troubleshooting

### Issue: "ANDROID_HOME not set"

**Solution**: Export the environment variable (see Prerequisites #2)

### Issue: "NDK not found"

**Solution**: Install NDK via Android Studio SDK Manager or:
```bash
sdkmanager "ndk;25.0.8775105"
```

### Issue: Build fails with Rust errors

**Solution**: Update Rust:
```bash
rustup update
```

### Issue: "No connected devices found"

**Solution**:
```bash
# Check connected devices
adb devices

# If empty, enable USB debugging on device
# Or start emulator
```

### Issue: App crashes on startup

**Solution**: Check device logs:
```bash
adb logcat | grep -i "prism\|tauri\|rust"
```

## Configuration Summary

| Config File | Purpose | What to Update |
|------------|---------|----------------|
| `prism-engine/wrangler.jsonc` | Backend deployment | OTPLESS credentials, D1 DB ID, R2 bucket |
| `prism/src/routes/+layout.svelte` | Frontend | Mappls API key |
| `prism/src/lib/auth.ts` | Frontend | Backend API URL |
| `prism/src/lib/offline/sync.ts` | Frontend | Backend API URL |
| `src-tauri/tauri.conf.json` | Tauri config | Already configured ✓ |
| `src-tauri/Cargo.toml` | Rust deps | Already configured ✓ |

## Next Steps

1. ✅ Install Android Studio & SDK
2. ✅ Set environment variables
3. ✅ Run setup script
4. ⏳ Get API keys (OTPLess, Mappls)
5. ⏳ Update configuration files
6. ⏳ Deploy backend to Cloudflare
7. ⏳ Build Android APK
8. ⏳ Test on device

## Quick Reference

```bash
# Full setup (one-time)
./scripts/setup-android.sh

# Development
bun run android:dev          # Run on device/emulator
bun run android:build        # Build debug APK

# Production
bun run android:build:release # Build release APK

# Deploy backend
cd ../prism-engine
wrangler deploy
```

---

**Need help?** Check Tauri Android docs: https://v2.tauri.app/start/prerequisites/#android
