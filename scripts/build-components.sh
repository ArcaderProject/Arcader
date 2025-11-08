#!/bin/bash
set -e

command -v bun >/dev/null 2>&1 || { echo "Error: Bun not installed"; exit 1; }
command -v godot >/dev/null 2>&1 || { echo "Error: Godot not installed"; exit 1; }

cd arcaderd
bun install
bun build --compile --minify --target=bun-linux-x64 ./index.js --outfile=arcaderd
cd ..

cd arcaderui
mkdir -p ../build/arcaderui
godot --headless --export-release "Linux/X11" ../build/arcaderui/arcaderui
cd ..