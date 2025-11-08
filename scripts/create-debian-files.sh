#!/bin/bash
set -e

VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "1.0.0")
VERSION=${VERSION#v}

cat > build/debian/DEBIAN/control << EOF
Package: arcader
Version: ${VERSION}
Section: games
Priority: optional
Architecture: amd64
Depends: libc6, systemd
Maintainer: ArcaderProject <noreply@github.com>
Description: Arcader Gaming System
 Arcader gaming system with UI and daemon service.
EOF

cat > build/debian/DEBIAN/postinst << 'EOF'
#!/bin/bash
set -e

chmod 755 /usr/bin/arcaderd
chmod 755 /usr/share/arcader/arcaderui

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications
fi

REAL_USER="${SUDO_USER:-$USER}"
REAL_USER_HOME=$(getent passwd "$REAL_USER" | cut -d: -f6)

if [ "$REAL_USER" != "root" ] && [ -n "$REAL_USER_HOME" ]; then
    sudo -u "$REAL_USER" XDG_RUNTIME_DIR="/run/user/$(id -u "$REAL_USER")" systemctl --user daemon-reload
    sudo -u "$REAL_USER" XDG_RUNTIME_DIR="/run/user/$(id -u "$REAL_USER")" systemctl --user enable arcaderd.service
    sudo -u "$REAL_USER" XDG_RUNTIME_DIR="/run/user/$(id -u "$REAL_USER")" systemctl --user start arcaderd.service
fi

echo "Arcader installed and daemon started"
EOF

cat > build/debian/DEBIAN/prerm << 'EOF'
#!/bin/bash
set -e

REAL_USER="${SUDO_USER:-$USER}"

if [ "$REAL_USER" != "root" ] && command -v systemctl >/dev/null 2>&1; then
    sudo -u "$REAL_USER" XDG_RUNTIME_DIR="/run/user/$(id -u "$REAL_USER")" systemctl --user stop arcaderd.service 2>/dev/null || true
    sudo -u "$REAL_USER" XDG_RUNTIME_DIR="/run/user/$(id -u "$REAL_USER")" systemctl --user disable arcaderd.service 2>/dev/null || true
fi
EOF

cat > build/debian/DEBIAN/postrm << 'EOF'
#!/bin/bash
set -e

case "$1" in
    purge)
        if command -v update-desktop-database >/dev/null 2>&1; then
            update-desktop-database /usr/share/applications
        fi
        ;;
esac
EOF

chmod 755 build/debian/DEBIAN/postinst
chmod 755 build/debian/DEBIAN/prerm
chmod 755 build/debian/DEBIAN/postrm