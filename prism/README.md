# PRISM Android

Field reporting app for civic infrastructure issues.

## Quick Start

```bash
# Setup (run once)
./prism.js setup

# Run development server
./prism.js dev
```

## Requirements

- **bun** - https://bun.sh
- **Rust** - https://rustup.rs  
- **Android Studio** - https://developer.android.com/studio

## Commands

| Command | Description |
|---------|-------------|
| `./prism.js setup` | Setup Android environment |
| `./prism.js dev` | Run in development mode |
| `./prism.js build` | Build APK |
| `./prism.js doctor` | Check environment |

## Windows Users

If you get connection errors, allow ports through firewall:
```powershell
# Run as Administrator
netsh advfirewall firewall add rule name="PRISM Dev" dir=in action=allow protocol=tcp localport=1420,1421
```

## Linux Users

Install Android SDK:
```bash
sudo apt install android-sdk
```

## Project Structure

```
prism/
├── src/              # Svelte frontend
├── src-tauri/        # Rust + Android
├── prism.js          # Main development tool
└── package.json
```

## Development

1. Connect Android device with USB debugging enabled
2. Run `./prism.js dev`
3. App will build and install automatically
4. Changes hot-reload on save

## Troubleshooting

**Port already in use:**
```bash
# Kill existing processes
npx kill-port 1420 1421
```

**Device not found:**
- Enable USB debugging in Developer Options
- Accept RSA fingerprint on device
- Run `adb devices` to verify

**Build fails:**
- Run `./prism.js doctor` to check environment
- Ensure Android SDK is installed
- Install Visual Studio Build Tools (Windows) or build-essential (Linux)
