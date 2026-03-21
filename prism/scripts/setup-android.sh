#!/bin/bash
# Android Setup Script for PRISM
# Run this after installing Android SDK

set -e

echo "🚀 PRISM Android Build Setup"
echo "=============================="

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v bun &> /dev/null; then
    echo "❌ bun is not installed. Install from https://bun.sh"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo is not installed. Install from https://rustup.rs"
    exit 1
fi

if [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  ANDROID_HOME not set. Make sure Android SDK is installed."
    echo "   Download from: https://developer.android.com/studio"
    exit 1
fi

echo "✅ All prerequisites found"
echo ""

# Install dependencies
echo "Installing dependencies..."
cd "$(dirname "$0")/../.."
bun install
cd src-tauri
cargo fetch

echo ""
echo "Adding Android targets..."
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

echo ""
echo "Initializing Android project..."
cd ..
bun run tauri android init

echo ""
echo "✅ Android project initialized!"
echo ""
echo "Next steps:"
echo "1. Update API keys in configuration files"
echo "2. Run: bun run tauri android dev    (for testing)"
echo "3. Run: bun run tauri android build  (for APK)"
echo ""
