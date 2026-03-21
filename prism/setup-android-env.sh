#!/bin/bash
# Setup Android environment for PRISM

export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# Verify setup
echo "Android Home: $ANDROID_HOME"
echo "SDK Manager: $(which sdkmanager)"
echo "ADB: $(which adb)"

# Create necessary directories
mkdir -p "$ANDROID_HOME/licenses"

# Accept licenses if not already done
if [ ! -f "$ANDROID_HOME/licenses/android-sdk-license" ]; then
echo "24333f8a63b6825ea9c5514f83c2829b004d1fee" > "$ANDROID_HOME/licenses/android-sdk-license"
echo "84831b9409646a918e30573bab4c9c91346d8abd" > "$ANDROID_HOME/licenses/android-sdk-preview-license"
fi

echo "Android environment configured!"
export NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653
