# PRISM Android Build - Quick Start

## 🚀 Setup (One-Time)

### 1. Install Prerequisites
- **Android Studio**: https://developer.android.com/studio
- **Rust**: https://rustup.rs (already installed ✓)
- **bun**: https://bun.sh (already installed ✓)

### 2. Set Environment Variables
Add to `~/.bashrc` or `~/.zshrc`:
```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export PATH="$ANDROID_HOME/platform-tools:$PATH"
export NDK_HOME="$ANDROID_HOME/ndk/25.0.8775105"
```

### 3. Install Android Components
```bash
# In Android Studio SDK Manager, install:
# - Android SDK Platform (API 34)
# - Android SDK Build-Tools
# - Android NDK (Side by side) 25.0.8775105
# - Android SDK Platform-Tools
```

### 4. Add Rust Targets
```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## 📱 Initialize Android Project

```bash
cd /home/arkaprav0/Prism/prism

# Run setup script
./scripts/setup-android.sh

# Or manually:
bun install
bun run tauri android init
```

## 🔑 Required API Keys

Before building, you need:

1. **OTPLess** (for phone auth): https://otpless.com
   - Add to: `prism-engine/wrangler.jsonc`

2. **Mappls** (for maps): https://mappls.com/developer
   - Add to: `prism/src/routes/+layout.svelte`

3. **Cloudflare D1 Database ID**
   - Create: `wrangler d1 create prism_board`
   - Add ID to: `prism-engine/wrangler.jsonc`

4. **Cloudflare R2 Bucket**
   - Create: `wrangler r2 bucket create prism-vault`

## 🛠️ Build Commands

```bash
# Development (run on device)
bun run android:dev

# Debug APK
bun run android:build

# Release APK
bun run android:build:release
```

## 📦 Output Location

APKs are saved to:
```
src-tauri/gen/android/app/build/outputs/apk/
├── debug/app-debug.apk
└── release/app-release.apk
```

## ☁️ Deploy Backend

```bash
cd ../prism-engine

# Create D1 database
wrangler d1 create prism_board

# Apply migrations
wrangler d1 migrations apply prism_board --remote

# Deploy
wrangler deploy
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `ANDROID_HOME not set` | Export the env variable |
| `NDK not found` | Install via Android Studio SDK Manager |
| `No connected devices` | Enable USB debugging or start emulator |
| Build fails | Run `rustup update` |

## 📋 Checklist

Before first build:
- [ ] Android Studio installed
- [ ] Environment variables set
- [ ] Rust Android targets added
- [ ] OTPLess credentials obtained
- [ ] Mappls API key obtained
- [ ] D1 database created
- [ ] R2 bucket created
- [ ] API keys configured in files
- [ ] Backend deployed to Cloudflare

## 📚 Full Documentation

See: `ANDROID_SETUP.md` for detailed instructions

---
**Ready to build!** Once you have the API keys, run `./scripts/setup-android.sh`
