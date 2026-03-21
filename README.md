# PRISM - Decentralized Civic Infrastructure

[![PRISM](https://img.shields.io/badge/PRISM-Civic%20Infrastructure-black)](https://github.com/yourusername/prism)
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri)](https://tauri.app)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)](https://svelte.dev)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com)

A decentralized civic infrastructure platform for reporting and managing urban issues (potholes, infrastructure damage, etc.) with built-in accountability and verification systems.

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Tauri v2 + Svelte 5 + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Workers + Hono.js
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Authentication**: SuperTokens (Passwordless phone OTP)
- **Maps**: Mappls (MapMyIndia)

### Design System

**Neo-Brutalism Tactical Theme:**
- Colors: `prism-black` (#171717), `prism-white`, `prism-surface`
- Success Green: #00FF00 (aggressive)
- Crisis Red: #FF0000
- Solid shadows (no blur): `shadow-solid-sm`, `shadow-solid-md`, `shadow-solid-lg`
- Hardware haptics on all interactions

## 📁 Project Structure

```
Prism/
├── prism/                          # Frontend (Tauri + Svelte 5)
│   ├── src/
│   │   ├── routes/                # SvelteKit routes
│   │   │   ├── +page.svelte      # Field Interface (Report Pothole)
│   │   │   ├── board/+page.svelte # War Room Executive Board
│   │   │   ├── login/+page.svelte # Authentication
│   │   │   └── ...
│   │   ├── lib/
│   │   │   ├── supertokens.ts    # Auth state management
│   │   │   ├── auth.ts           # Auth service wrapper
│   │   │   ├── tauri/            # Tauri plugin wrappers
│   │   │   │   ├── camera.ts     # Camera API
│   │   │   │   ├── geolocation.ts # GPS
│   │   │   │   └── haptics.ts    # Haptic feedback
│   │   │   └── ...
│   │   └── app.css               # Global styles
│   ├── src-tauri/                # Tauri native bindings
│   │   ├── gen/android/          # Android project
│   │   ├── target/               # Rust build output
│   │   └── tauri.conf.json       # Tauri config
│   └── package.json
│
├── prism-engine/                  # Backend (Cloudflare Workers)
│   ├── src/
│   │   └── index.ts              # Hono.js API routes
│   ├── migrations/               # D1 database migrations
│   ├── wrangler.jsonc            # Cloudflare config
│   └── package.json
│
└── Documentation/
    ├── prism_blueprint.md        # Full architecture blueprint
    ├── implementation_plan.md    # Implementation roadmap
    └── Gemini.md                 # Current status/progress
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18+) or **Bun** (recommended)
- **Rust** toolchain
- **Android SDK** (for mobile builds)
- **Cloudflare** account (for backend)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/prism.git
   cd prism
   ```

2. **Install frontend dependencies:**
   ```bash
   cd prism
   bun install
   ```

3. **Install backend dependencies:**
   ```bash
   cd ../prism-engine
   bun install
   ```

4. **Set up environment variables:**
   
   Create `prism/.env`:
   ```env
   VITE_SUPERTOKENS_CORE_URL=your_supertokens_core_url
   VITE_API_BASE_URL=http://localhost:8787
   ```

   Create `prism-engine/.env`:
   ```env
   SUPERTOKENS_CORE_URL=your_supertokens_core_url
   ```

## 🛠️ Development

### Start Development Servers

**Terminal 1 - Backend:**
```bash
cd prism-engine
bun run dev
# Runs on http://localhost:8787
```

**Terminal 2 - Frontend:**
```bash
cd prism
bun run dev
# Runs on http://localhost:1420
```

### Android Development

**Option A: Tauri Dev Mode (Hot Reload):**
```bash
cd prism
bun run tauri android dev
```

**Option B: Build APK:**
```bash
cd prism
bun run tauri android build --target aarch64
```

## 📱 Building Android APK

### Method 1: Automated Build Script

Create `prism/build-apk.sh`:

```bash
#!/bin/bash
set -e

echo "🧹 Cleaning previous builds..."
rm -rf build .svelte-kit
rm -rf src-tauri/gen/android/app/build
rm -rf src-tauri/target

echo "📦 Installing dependencies..."
bun install

echo "🔨 Building frontend..."
bun run build

echo "🤖 Building Android APK for arm64..."
bun run tauri android build --target aarch64

echo "✍️  Aligning and signing APK..."
cd src-tauri/gen/android/app/build/outputs/apk/arm64/release

# Align APK
/home/$USER/Android/Sdk/build-tools/34.0.0/zipalign -f 4 \
  app-arm64-release-unsigned.apk \
  app-arm64-release-aligned.apk

# Sign with v2/v3 scheme (REQUIRED for Android 14+)
/home/$USER/Android/Sdk/build-tools/34.0.0/apksigner sign \
  --ks /home/$USER/Prism/prism/src-tauri/gen/android/debug.keystore \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out app-arm64-release-signed.apk \
  app-arm64-release-aligned.apk

# Verify signature
/home/$USER/Android/Sdk/build-tools/34.0.0/apksigner verify -v app-arm64-release-signed.apk

# Copy to project root
cp app-arm64-release-signed.apk \
   /home/$USER/Prism/prism/src-tauri/gen/android/PRISM-v0.1.0.apk

echo "✅ APK ready!"
ls -lh /home/$USER/Prism/prism/src-tauri/gen/android/PRISM-v0.1.0.apk
```

Run:
```bash
chmod +x build-apk.sh
./build-apk.sh
```

### Method 2: Manual Step-by-Step

**Step 1: Clean**
```bash
cd prism
rm -rf build .svelte-kit
rm -rf src-tauri/gen/android/app/build
rm -rf src-tauri/target
cd src-tauri && cargo clean && cd ..
```

**Step 2: Build**
```bash
bun install
bun run build
bun run tauri android build --target aarch64
```

**Step 3: Sign**
```bash
cd src-tauri/gen/android/app/build/outputs/apk/arm64/release

# Align
zipalign -v 4 app-arm64-release-unsigned.apk app-arm64-release-aligned.apk

# Sign (v2/v3 scheme)
apksigner sign \
  --ks ../../../../../../debug.keystore \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out app-arm64-release-signed.apk \
  app-arm64-release-aligned.apk

# Verify
apksigner verify -v app-arm64-release-signed.apk
```

**⚠️ CRITICAL:** You MUST use `apksigner` (not `jarsigner`) for Android 14+ (Target SDK 36). Android 14 requires signature scheme v2 minimum.

## 🔧 Troubleshooting

### Issue: "App not installed as package appears to be invalid"

**Solution 1:** Sign with apksigner (v2/v3 scheme)
```bash
# WRONG - jarsigner only creates v1
jarsigner -keystore debug.keystore app.apk androiddebugkey

# CORRECT - apksigner creates v2/v3
apksigner sign --ks debug.keystore --out signed.apk unsigned.apk
```

**Solution 2:** Use arm64-specific APK (not universal)
- Universal APKs sometimes fail on certain devices
- Build with `--target aarch64` for 64-bit phones

**Solution 3:** Uninstall previous version completely
```bash
adb uninstall com.prism.civic
```

### Issue: White Screen / App Crashes on Startup

**Cause:** JavaScript errors during mount

**Common Fixes:**

1. **Svelte 5 Runes Error:**
   - `$state` and `$derived` can ONLY be used inside components
   - NEVER at module level (in `.ts` files)
   - Use subscription patterns for module-level state

2. **Window Object Access:**
   ```svelte
   <!-- WRONG -->
   {#if window.mappls}
   
   <!-- CORRECT -->
   {#if typeof window !== 'undefined' && (window as any).mappls}
   ```

3. **Tauri Store API:**
   ```typescript
   // WRONG
   const { Store } = await import('@tauri-apps/plugin-store');
   const store = new Store('auth.json');
   
   // CORRECT
   const { load } = await import('@tauri-apps/plugin-store');
   const store = await load('auth.json', { autoSave: true });
   ```

### Issue: Build Fails with "cannot find crate"

```bash
cd prism/src-tauri
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
cargo update
```

### Issue: Backend Not Responding

1. Check if backend is running:
   ```bash
   curl http://localhost:8787/api/v1/health
   ```

2. Check wrangler configuration:
   ```bash
   cd prism-engine
   wrangler d1 migrations list prism_board --local
   ```

## 🗄️ Database Schema

See `prism-engine/migrations/0001_init_schema.sql` for full schema.

Key tables:
- **Users**: Role-based access (crony, contractor, admin)
- **Whitelisted_Sources**: Trusted party verification
- **Reports**: Geolocation-tagged incidents (DIGIPIN format)
- **Interventions**: Spatial drift calculation for accountability
- **Verifications**: Final ground-truth loop

## 📡 API Endpoints

### Phase 1: Cold Start (Harvesting)
- `POST /api/v1/reports/harvest` - Submit new report
- `GET /api/v1/reports/nearby` - Find nearby potholes

### Phase 2: AI Activation
- Authentication routes via SuperTokens
- Contractor management
- Intervention tracking

See `prism-engine/src/index.ts` for all routes.

## 🎨 Frontend Components

### Key Components
- **+page.svelte**: Field interface (camera, GPS, submit)
- **board/+page.svelte**: War Room dashboard
- **login/+page.svelte**: Phone OTP authentication
- **GeoFenceWarning.svelte**: Duplicate detection warning

### State Management
- Auth store uses subscription pattern (not Svelte runes at module level)
- Reactive state via `$state`, `$derived` in components only
- Tauri plugins: camera, geolocation, haptics

## 📋 Current Status

**Phase 6: Verification** ✅

Completed:
- [x] Project scaffolding (Tauri + Svelte 5)
- [x] Backend infrastructure (D1, R2, Hono)
- [x] Tactical interface (Neo-Brutalism design)
- [x] Hardware integration (camera, GPS, haptics)
- [x] Authentication (SuperTokens phone OTP)
- [x] Mobile builds (Android APK)

In Progress:
- [ ] APK crash debugging
- [ ] End-to-end testing
- [ ] iOS build support

Known Issues:
- APK installation requires v2/v3 signature scheme
- Must use arm64-specific builds (not universal)
- Some TypeScript type warnings (non-blocking)

## 🤝 Contributing

1. Follow existing code style (Svelte 5 runes, Neo-Brutalism design)
2. Test on both desktop and mobile
3. Use `bun` for package management
4. Run type checking: `bun run check`
5. Update this README with any architectural changes

## 📜 License

[Add your license here]

## 🔗 Resources

- [Tauri Documentation](https://tauri.app)
- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/what-are-runes)
- [Hono.js](https://hono.dev)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [SuperTokens](https://supertokens.com)

---

**Last Updated:** March 21, 2026
**Version:** 0.1.0
**Status:** In Development
