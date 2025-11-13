#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

GITHUB_REPO="ArcaderProject/Arcader"

get_first_user() {
    if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
        echo "$SUDO_USER"
        return
    fi
    
    FIRST_USER=$(awk -F: '$3 >= 1000 && $3 < 65534 {print $1; exit}' /etc/passwd)
    
    if [ -n "$FIRST_USER" ]; then
        echo "$FIRST_USER"
        return
    fi
    
    if [ "$USER" != "root" ]; then
        echo "$USER"
        return
    fi
    
    echo ""
}

INSTALL_USER=$(get_first_user)
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi
    
    if [ -z "$INSTALL_USER" ]; then
        log_error "Could not detect a non-root user. Please create a user first."
        exit 1
    fi
}

install_arcader_package() {
    log_info "Step 1: Installing Arcader package..."
    
    log_info "Installing required tools and dependencies..."
    apt-get update -qq
    apt-get install -y -qq curl jq wget ca-certificates p7zip-full
    
    log_info "Fetching latest release from GitHub..."
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/${GITHUB_REPO}/releases/latest")
    
    DEB_URL=$(echo "$LATEST_RELEASE" | jq -r '.assets[] | select(.name | endswith(".deb")) | .browser_download_url' | head -n 1)
    
    if [ -z "$DEB_URL" ] || [ "$DEB_URL" = "null" ]; then
        log_warn "No .deb file found in latest GitHub release"
        log_info "Checking for local .deb file..."
        
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        LOCAL_DEB=$(find "$SCRIPT_DIR" -maxdepth 1 -name "arcader_*.deb" | head -n 1)
        
        if [ -n "$LOCAL_DEB" ]; then
            log_info "Found local .deb file: $LOCAL_DEB"
            DEB_FILE="$LOCAL_DEB"
        else
            log_error "No .deb file found. Please build the package first or upload to GitHub releases."
            exit 1
        fi
    else
        log_info "Downloading .deb package from: $DEB_URL"
        DEB_FILE="/tmp/arcader_latest.deb"
        wget -q --show-progress -O "$DEB_FILE" "$DEB_URL"
    fi
    
    log_info "Installing Arcader package..."
    apt-get install -y -qq "$DEB_FILE"
    
    log_info "✓ Arcader package installed successfully"
}

setup_audio() {
    log_info "Step 2: Setting up audio support..."
    
    log_info "Installing audio packages..."
    apt-get install -y -qq \
        alsa-utils \
        pulseaudio \
        pulseaudio-utils \
        pavucontrol \
        libasound2-plugins \
        passwd
    
    /usr/sbin/usermod -aG audio "$INSTALL_USER"
    
    USER_HOME=$(getent passwd "$INSTALL_USER" | cut -d: -f6)
    
    mkdir -p "$USER_HOME/.config/autostart"
    
    cat > "$USER_HOME/.config/autostart/pulseaudio.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=PulseAudio
Exec=pulseaudio --start
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
    
    chown -R "$INSTALL_USER:$INSTALL_USER" "$USER_HOME/.config"
    
    log_info "✓ Audio support configured"
}

setup_openbox() {
    log_info "Step 3: Installing and configuring Openbox..."
    
    log_info "Installing Openbox and X server..."
    apt-get install -y -qq \
        xorg \
        openbox \
        obconf \
        xinit \
        x11-xserver-utils \
        mesa-utils \
        libgl1-mesa-dri \
        libglx-mesa0 \
        iputils-ping
    
    USER_HOME=$(getent passwd "$INSTALL_USER" | cut -d: -f6)
    
    mkdir -p "$USER_HOME/.config/openbox"
    
    log_info "Configuring Openbox autostart..."
    cat > "$USER_HOME/.config/openbox/autostart" << 'EOF'
#!/bin/bash

pulseaudio --start &

xset s off
xset -dpms
xset s noblank

/usr/bin/arcaderui --fullscreen &
EOF
    
    chmod +x "$USER_HOME/.config/openbox/autostart"
    
    cat > "$USER_HOME/.config/openbox/menu.xml" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_menu xmlns="http://openbox.org/3.4/menu">
  <menu id="root-menu" label="Openbox 3">
    <item label="Arcader">
      <action name="Execute">
        <command>/usr/bin/arcaderui</command>
      </action>
    </item>
  </menu>
</openbox_menu>
EOF
    
    chown -R "$INSTALL_USER:$INSTALL_USER" "$USER_HOME/.config/openbox"
    
    log_info "✓ Openbox configured"
}

setup_autologin() {
    log_info "Step 4: Configuring autologin..."
    
    USER_HOME=$(getent passwd "$INSTALL_USER" | cut -d: -f6)
    
    log_info "Creating .xinitrc..."
    cat > "$USER_HOME/.xinitrc" << 'EOF'
#!/bin/bash

[ -f ~/.Xresources ] && xrdb -merge ~/.Xresources

exec openbox-session
EOF
    
    chmod +x "$USER_HOME/.xinitrc"
    chown "$INSTALL_USER:$INSTALL_USER" "$USER_HOME/.xinitrc"
    
    log_info "Configuring getty autologin..."
    
    mkdir -p /etc/systemd/system/getty@tty1.service.d
    
    cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $INSTALL_USER --noclear %I \$TERM
EOF
    
    log_info "Configuring automatic X server start..."
    
    cat >> "$USER_HOME/.bash_profile" << 'EOF'

if [ -z "$DISPLAY" ] && [ "$XDG_VTNR" = "1" ]; then
    exec startx
fi
EOF
    
    chown "$INSTALL_USER:$INSTALL_USER" "$USER_HOME/.bash_profile"
    
    systemctl daemon-reload
    
    log_info "✓ Autologin configured"
}

final_configuration() {
    log_info "Step 5: Applying final configuration..."
    
    systemctl set-default multi-user.target
    
    log_info "Enabling services..."
    
    USER_HOME=$(getent passwd "$INSTALL_USER" | cut -d: -f6)
    USER_ID=$(id -u "$INSTALL_USER")
    
    loginctl enable-linger "$INSTALL_USER" 2>/dev/null || true
    
    mkdir -p "$USER_HOME/.config/systemd/user"
    chown -R "$INSTALL_USER:$INSTALL_USER" "$USER_HOME/.config/systemd"
    
    log_info "Enabling arcaderd service for $INSTALL_USER..."
    
    if [ -d "/run/user/$USER_ID" ]; then
        sudo -u "$INSTALL_USER" XDG_RUNTIME_DIR="/run/user/$USER_ID" systemctl --user daemon-reload 2>/dev/null || true
        sudo -u "$INSTALL_USER" XDG_RUNTIME_DIR="/run/user/$USER_ID" systemctl --user enable arcaderd.service 2>/dev/null || true
    fi
    
    if [ -f "/usr/lib/systemd/user/arcaderd.service" ]; then
        mkdir -p "$USER_HOME/.config/systemd/user/default.target.wants"
        ln -sf /usr/lib/systemd/user/arcaderd.service "$USER_HOME/.config/systemd/user/default.target.wants/arcaderd.service" 2>/dev/null || true
        chown -R "$INSTALL_USER:$INSTALL_USER" "$USER_HOME/.config/systemd/user"
    fi
    
    log_info "Adding arcaderd to Openbox autostart as fallback..."
    sed -i '/wait_for_network/a\
\
sleep 2\
systemctl --user start arcaderd.service 2>/dev/null || /usr/bin/arcaderd &\
sleep 1' "$USER_HOME/.config/openbox/autostart"
    
    log_info "✓ Final configuration complete"
}

main() {
    check_root
    
    log_info "Installing for user: $INSTALL_USER"
    echo

    install_arcader_package
    echo
    setup_audio
    echo
    setup_openbox
    echo
    setup_autologin
    echo
    final_configuration
    echo

    log_info "You can now reboot the system:"
    log_info "  sudo reboot"
    echo
}

main "$@"
