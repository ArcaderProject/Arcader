#!/bin/bash
set -e

mkdir -p build/debian/usr/lib/systemd/user
cat > build/debian/usr/lib/systemd/user/arcaderd.service << 'EOF'
[Unit]
Description=Arcader Daemon
After=graphical-session.target network-online.target
Wants=graphical-session.target network-online.target

[Service]
Type=simple
WorkingDirectory=/var/lib/arcader
Environment="ARCADER_DASHBOARD_PATH=/usr/share/arcader/dashboard"
Environment="ARCADER_FIRMWARE_DIR=/usr/share/arcader/firmware"
ExecStart=/usr/bin/arcaderd
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=arcaderd
KillMode=mixed
KillSignal=SIGINT
TimeoutStopSec=5
ExecStartPre=/bin/sleep 5

[Install]
WantedBy=default.target
EOF