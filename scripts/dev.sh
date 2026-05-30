#!/bin/bash

# Development script for starting Expo
echo "🚀 Starting Expo for development..."
echo "🎉 ShowDown - TV Quiz Party Games"

# Check if Expo is already running
if pgrep -f "expo start" > /dev/null; then
    echo "✅ Expo is already running!"
    echo "📱 Open Expo Go app and scan the QR code"
    exit 0
fi

# Start Expo in clear mode with tunnel for easy device testing
echo "🔄 Starting Expo development server..."
npx expo start --clear --tunnel

echo ""
echo "✅ Expo development server started!"
echo "📱 Open Expo Go app and scan the QR code"
echo "💡 Press 'i' to open in iOS simulator"
echo "💡 Press 'a' to open in Android emulator"
echo "💡 Press 'c' to clear cache"
echo "💡 Press 'q' to quit"
