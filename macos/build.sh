#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MAC="$ROOT/macos"
APP="$MAC/dist/Instant Solver.app"
BIN="$APP/Contents/MacOS/InstantSolver"

rm -rf "$MAC/dist"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

ARCH="$(uname -m)"
swiftc -parse-as-library \
  -O \
  -target "${ARCH}-apple-macos14.0" \
  -sdk "$(xcrun --sdk macosx --show-sdk-path)" \
  -framework SwiftUI \
  -framework AppKit \
  -framework WebKit \
  -framework Carbon \
  "$MAC/MathEval.swift" \
  "$MAC/Overlay.swift" \
  "$MAC/InstantSolverApp.swift" \
  -o "$BIN"

cp "$MAC/Info.plist" "$APP/Contents/Info.plist"

echo "Building web assets…"
(cd "$ROOT" && npm run build)

rm -rf "$APP/Contents/Resources/web"
cp -R "$ROOT/dist" "$APP/Contents/Resources/web"

chmod +x "$BIN"

echo "Built $APP"
