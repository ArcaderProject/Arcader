#!/bin/bash
set -e

command -v bun >/dev/null 2>&1 || { echo "Error: Bun not installed"; exit 1; }
command -v godot >/dev/null 2>&1 || { echo "Error: Godot not installed"; exit 1; }

GODOT_VERSION=$(godot --version 2>/dev/null | head -n1 | cut -d'.' -f1-3 || echo "4.5.1")
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
bun install
bun build --compile --minify --target=bun-linux-x64 ./index.js --outfile=arcaderd
cd ..

cd dashboard
echo "Building dashboard assets..."
pnpm install
pnpm run build
cd ..

cd arcaderui
mkdir -p ../build/arcaderui
godot --headless --export-release "Linux/X11" ../build/arcaderui/arcaderui
cd ..