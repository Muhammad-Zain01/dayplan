#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_BUNDLE="$ROOT_DIR/.build/DayPlan.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
ICONSET_DIR="$CONTENTS_DIR/Resources/AppIcon.iconset"

swift build --package-path "$ROOT_DIR" -c debug
rm -rf "$APP_BUNDLE"
mkdir -p "$CONTENTS_DIR/MacOS" "$ICONSET_DIR"
cp "$ROOT_DIR/.build/debug/DayPlan" "$CONTENTS_DIR/MacOS/DayPlan"

swift "$ROOT_DIR/Scripts/GenerateAppIcon.swift" "$ROOT_DIR/.build/dayplan-icon.png"
for size in 16 32 64 128 256 512 1024; do
    sips -z "$size" "$size" "$ROOT_DIR/.build/dayplan-icon.png" \
        --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
done
cp "$ICONSET_DIR/icon_32x32.png" "$ICONSET_DIR/icon_16x16@2x.png"
cp "$ICONSET_DIR/icon_64x64.png" "$ICONSET_DIR/icon_32x32@2x.png"
cp "$ICONSET_DIR/icon_256x256.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$ICONSET_DIR/icon_512x512.png" "$ICONSET_DIR/icon_256x256@2x.png"
cp "$ICONSET_DIR/icon_1024x1024.png" "$ICONSET_DIR/icon_512x512@2x.png"
iconutil --convert icns --output "$CONTENTS_DIR/Resources/AppIcon.icns" "$ICONSET_DIR"
rm -rf "$ICONSET_DIR" "$ROOT_DIR/.build/dayplan-icon.png"

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key><string>en</string>
    <key>CFBundleExecutable</key><string>DayPlan</string>
    <key>CFBundleIconFile</key><string>AppIcon</string>
    <key>CFBundleIdentifier</key><string>com.muhammadzain.dayplan</string>
    <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
    <key>CFBundleName</key><string>DayPlan</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>LSMinimumSystemVersion</key><string>14.0</string>
    <key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
    <key>NSHighResolutionCapable</key><true/>
    <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
PLIST

codesign --force --deep --sign - "$APP_BUNDLE"
printf 'Packaged app: %s\n' "$APP_BUNDLE"
