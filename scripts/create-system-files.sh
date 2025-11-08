#!/bin/bash
set -e

mkdir -p build/debian/usr/lib/systemd/user
cat > build/debian/usr/lib/systemd/user/arcaderd.service << 'EOF'
[Unit]
Description=Arcader Daemon
After=graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/arcaderd
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=arcaderd
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=5

[Install]
WantedBy=default.target
EOF

cat > build/debian/usr/share/applications/arcader.desktop << 'EOF'
[Desktop Entry]
Name=Arcader
Comment=Arcader Gaming Interface
Exec=/usr/share/arcader/arcaderui
Icon=arcader
Terminal=false
Type=Application
Categories=Game;
EOF

cat > build/debian/usr/bin/arcaderui << 'EOF'
#!/bin/bash
cd /usr/share/arcader
exec ./arcaderui "$@"
EOF
chmod 755 build/debian/usr/bin/arcaderui