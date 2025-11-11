#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rm -rf build/
rm -f *.deb

command -v bun >/dev/null 2>&1 || { echo "Error: Bun not installed"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm not installed"; exit 1; }
command -v godot >/dev/null 2>&1 || { echo "Error: Godot not installed"; exit 1; }
command -v dpkg-deb >/dev/null 2>&1 || { echo "Error: dpkg-deb not installed"; exit 1; }

"$SCRIPT_DIR/build-components.sh"
"$SCRIPT_DIR/setup-package-structure.sh"
"$SCRIPT_DIR/create-system-files.sh"
"$SCRIPT_DIR/create-debian-files.sh"
"$SCRIPT_DIR/build-deb.sh"