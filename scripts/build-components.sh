#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/arch-env.sh"

command -v cargo >/dev/null 2>&1 || { echo "Error: cargo (Rust) not installed"; exit 1; }
command -v cargo-zigbuild >/dev/null 2>&1 || { echo "Error: cargo-zigbuild not installed (pip install cargo-zigbuild ziglang)"; exit 1; }
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
cargo zigbuild --release --target "$RUST_TARGET"
cp "target/$RUST_TARGET/release/arcaderd" arcaderd
cd ..

cd dashboard
echo "Building dashboard assets..."
pnpm install
pnpm run build
cd ..

echo "Building unix-socket GDExtension for $GD_LIB_ARCH ..."
EXT_TRIPLE="${EXT_RUST_TARGET%%.*}"
cd extensions/unixsocket
rustup target add "$EXT_TRIPLE" 2>/dev/null || true
cargo zigbuild --release --target "$EXT_RUST_TARGET"
cp "target/$EXT_TRIPLE/release/libunixsocket.so" \
   "../../arcaderui/addons/unix-socket/libunixsocket.linux.release.${GD_LIB_ARCH}.so"
cd ../..

cd arcaderui
mkdir -p ../build/arcaderui
godot --headless --export-release "$GODOT_PRESET" ../build/arcaderui/arcaderui
cd ..