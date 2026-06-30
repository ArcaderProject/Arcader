#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/arch-env.sh"

command -v dpkg-deb >/dev/null 2>&1 || { echo "Error: dpkg-deb not installed"; exit 1; }

VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "1.0.0")
VERSION=${VERSION#v}

PACKAGE_NAME="arcader_${VERSION}_${DEB_ARCH}.deb"

dpkg-deb --build build/debian "$PACKAGE_NAME"
echo "Built: $PACKAGE_NAME"