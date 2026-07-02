#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/arch-env.sh"

command -v cargo >/dev/null 2>&1 || { echo "Error: cargo (Rust) not installed"; exit 1; }
command -v cargo-zigbuild >/dev/null 2>&1 || { echo "Error: cargo-zigbuild not installed (pip install cargo-zigbuild ziglang)"; exit 1; }

echo "Building for $DEB_ARCH (rust: $RUST_TARGET)"

"$SCRIPT_DIR/build-firmware.sh"

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
