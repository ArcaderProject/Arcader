#!/bin/bash
set -e

mkdir -p build/debian/DEBIAN
mkdir -p build/debian/usr/bin
mkdir -p build/debian/usr/share/arcader
mkdir -p build/debian/usr/share/arcader/dashboard
mkdir -p build/debian/usr/lib/systemd/user
mkdir -p build/debian/usr/share/applications
mkdir -p build/debian/usr/share/pixmaps

cp arcaderd/arcaderd build/debian/usr/bin/
chmod +x build/debian/usr/bin/arcaderd

cp -r build/arcaderui/* build/debian/usr/share/arcader/
chmod +x build/debian/usr/share/arcader/arcaderui

cp -r dashboard/dist/* build/debian/usr/share/arcader/dashboard/

cp arcaderui/icon.png build/debian/usr/share/pixmaps/arcader.png