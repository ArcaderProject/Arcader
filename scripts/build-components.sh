#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/arch-env.sh"

command -v cargo >/dev/null 2>&1 || { echo "Error: cargo (Rust) not installed"; exit 1; }
command -v godot >/dev/null 2>&1 || { echo "Error: Godot not installed"; exit 1; }

echo "Building for $DEB_ARCH (rust: $RUST_TARGET, godot: $GODOT_PRESET)"

GODOT_VERSION=4.6
TEMPLATE_DIR="$HOME/.local/share/godot/export_templates/${GODOT_VERSION}.stable"

if [ ! -f "$TEMPLATE_DIR/linux_release.x86_64" ]; then
    echo "Godot export templates not found, downloading..."
    mkdir -p "$TEMPLATE_DIR"

    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}-stable/Godot_v${GODOT_VERSION}-stable_export_templates.tpz"
    unzip -q "Godot_v${GODOT_VERSION}-stable_export_templates.tpz"
    cp templates/* "$TEMPLATE_DIR/"

    cd - >/dev/null
    rm -rf "$TEMP_DIR"
fi

cd arcaderd
rustup target add "$RUST_TARGET" 2>/dev/null || true
cargo build --release --target "$RUST_TARGET"
cp "target/$RUST_TARGET/release/arcaderd" arcaderd
cd ..

cd dashboard
echo "Building dashboard assets..."
pnpm install
pnpm run build
cd ..

cd arcaderui
mkdir -p ../build/arcaderui
godot --headless --export-release "$GODOT_PRESET" ../build/arcaderui/arcaderui
cd ..