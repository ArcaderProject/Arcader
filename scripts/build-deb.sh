#!/bin/bash
set -e

command -v dpkg-deb >/dev/null 2>&1 || { echo "Error: dpkg-deb not installed"; exit 1; }

VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "1.0.0")
VERSION=${VERSION#v}

PACKAGE_NAME="arcader_${VERSION}_amd64.deb"

dpkg-deb --build build/debian "$PACKAGE_NAME"
echo "Built: $PACKAGE_NAME"