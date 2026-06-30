#!/bin/bash

DEB_ARCH="${DEB_ARCH:-amd64}"

case "$DEB_ARCH" in
    amd64)
        RUST_TARGET="x86_64-unknown-linux-musl"
        GODOT_PRESET="Linux/X11"
        EXT_RUST_TARGET="x86_64-unknown-linux-gnu.2.34"
        GD_LIB_ARCH="x86_64"
        ;;
    i386)
        RUST_TARGET="i686-unknown-linux-musl"
        GODOT_PRESET="Linux/X11 (32-bit)"
        EXT_RUST_TARGET="i686-unknown-linux-gnu.2.34"
        GD_LIB_ARCH="x86_32"
        ;;
    *)
        echo "Error: unsupported DEB_ARCH '$DEB_ARCH' (expected 'amd64' or 'i386')" >&2
        exit 1
        ;;
esac

export DEB_ARCH RUST_TARGET GODOT_PRESET EXT_RUST_TARGET GD_LIB_ARCH
