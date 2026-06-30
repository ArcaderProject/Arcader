#!/bin/bash

DEB_ARCH="${DEB_ARCH:-amd64}"

case "$DEB_ARCH" in
    amd64)
        RUST_TARGET="x86_64-unknown-linux-gnu"
        GODOT_PRESET="Linux/X11"
        ;;
    i386)
        RUST_TARGET="i686-unknown-linux-gnu"
        GODOT_PRESET="Linux/X11 (32-bit)"
        ;;
    *)
        echo "Error: unsupported DEB_ARCH '$DEB_ARCH' (expected 'amd64' or 'i386')" >&2
        exit 1
        ;;
esac

export DEB_ARCH RUST_TARGET GODOT_PRESET
