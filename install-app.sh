#!/bin/bash

echo "🚀 Installing Bubblewrap App..."
echo "Make sure your Android device is connected via USB with USB debugging enabled"

# Check if adb is available
if command -v adb &> /dev/null; then
    ADB_CMD="adb"
elif [ -f "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
    ADB_CMD="$HOME/Library/Android/sdk/platform-tools/adb"
else
    echo "❌ ADB not found. Please install Android SDK or use manual APK installation."
    echo "📱 Manual installation: Enable 'Unknown Sources' in Settings and tap the APK file."
    exit 1
fi

# Check for connected devices
echo "📱 Checking for connected devices..."
$ADB_CMD devices

# Install the APK
echo "📦 Installing app-release-signed.apk..."
$ADB_CMD install app-release-signed.apk

if [ $? -eq 0 ]; then
    echo "✅ Installation successful!"
    echo "🎉 Launching the app..."
    $ADB_CMD shell am start -n fun.store.twa/.LauncherActivity
    echo "🚀 App should now be running on your device!"
else
    echo "❌ Installation failed. Try manual APK installation instead."
fi 