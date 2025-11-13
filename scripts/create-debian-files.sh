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
Depends: libc6, systemd, p7zip-full
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

get_install_user() {
    if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
        echo "$SUDO_USER"
        return
    fi
    
    FIRST_USER=$(awk -F: '$3 >= 1000 && $3 < 65534 {print $1; exit}' /etc/passwd)
    if [ -n "$FIRST_USER" ]; then
        echo "$FIRST_USER"
        return
    fi
    
    echo ""
}

INSTALL_USER=$(get_install_user)

if [ -z "$INSTALL_USER" ] || [ "$INSTALL_USER" = "root" ]; then
    echo "Warning: Could not detect non-root user. Skipping service setup."
    echo "Please run 'systemctl --user enable arcaderd.service' as your user."
    exit 0
fi

USER_HOME=$(getent passwd "$INSTALL_USER" | cut -d: -f6)
USER_ID=$(id -u "$INSTALL_USER")

mkdir -p /var/lib/arcader
chown -R "$INSTALL_USER:$INSTALL_USER" /var/lib/arcader
chmod -R 755 /var/lib/arcader

loginctl enable-linger "$INSTALL_USER" 2>/dev/null || true

mkdir -p "$USER_HOME/.config/systemd/user/default.target.wants"
chown -R "$INSTALL_USER:$INSTALL_USER" "$USER_HOME/.config/systemd"

ln -sf /usr/lib/systemd/user/arcaderd.service "$USER_HOME/.config/systemd/user/default.target.wants/arcaderd.service" 2>/dev/null || true

if [ -d "/run/user/$USER_ID" ]; then
    sudo -u "$INSTALL_USER" XDG_RUNTIME_DIR="/run/user/$USER_ID" systemctl --user daemon-reload 2>/dev/null || true
    sudo -u "$INSTALL_USER" XDG_RUNTIME_DIR="/run/user/$USER_ID" systemctl --user start arcaderd.service 2>/dev/null || true
    echo "Arcader daemon started for user $INSTALL_USER"
else
    echo "Arcader installed. Service will start on next login for user $INSTALL_USER"
fi

echo "Arcader installation complete"
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