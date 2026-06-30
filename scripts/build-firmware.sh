#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SKETCH_DIR="$ROOT/arduino/coin_acceptor"
SKETCH="$SKETCH_DIR/coin_acceptor.ino"
FW_DIR="$ROOT/arcaderd/firmware"
FQBN="arduino:avr:uno"

mkdir -p "$FW_DIR"

if ! command -v arduino-cli >/dev/null 2>&1; then
    echo "build-firmware: arduino-cli not found; keeping committed firmware hex."
    if [ ! -f "$FW_DIR/coin_acceptor.hex" ]; then
        echo "build-firmware: ERROR - no committed hex at $FW_DIR/coin_acceptor.hex" >&2
        exit 1
    fi
    exit 0
fi

FW_VERSION=$(grep -oE 'FW_VERSION[[:space:]]*=[[:space:]]*[0-9]+' "$SKETCH" | grep -oE '[0-9]+' | head -1)
if [ -z "$FW_VERSION" ]; then
    echo "build-firmware: ERROR - could not parse FW_VERSION from sketch" >&2
    exit 1
fi

arduino-cli core update-index >/dev/null
arduino-cli core install arduino:avr >/dev/null

BUILD_DIR="$ROOT/arduino/build"
arduino-cli compile --fqbn "$FQBN" --output-dir "$BUILD_DIR" "$SKETCH_DIR"

cp "$BUILD_DIR/coin_acceptor.ino.hex" "$FW_DIR/coin_acceptor.hex"
printf '%s\n' "$FW_VERSION" > "$FW_DIR/coin_acceptor.version"

echo "build-firmware: wrote $FW_DIR/coin_acceptor.hex (v$FW_VERSION)"
