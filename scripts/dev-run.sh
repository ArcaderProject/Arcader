#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB="$ROOT/arcaderd/data/app.db"
DEV_XDG="/tmp/arcader-dev"
API="http://127.0.0.1:5328"
SCREEN_SIZE="${ARCADER_DEV_SIZE:-1600x900}"

admin_password() {
    python3 - "$DB" <<'PY'
import sqlite3, sys
con = sqlite3.connect(sys.argv[1])
row = con.execute("SELECT value FROM config WHERE key='admin.password'").fetchone()
print(row[0] if row else "")
PY
}

add_time() {
    local seconds="${1:-300}"
    curl -s -X POST "$API/api/coin/add" \
        -H "Authorization: Bearer $(admin_password)" \
        -H "Content-Type: application/json" \
        -d "{\"seconds\": $seconds}" >/dev/null && \
        echo "Added ${seconds}s of play time."
}

if [ "${1:-}" = "add" ]; then
    add_time "${2:-300}"
    exit 0
fi

NESTED=1
[ "${1:-}" = "--here" ] && NESTED=0

command -v godot >/dev/null || { echo "Error: godot not installed"; exit 1; }

if ss -ltn 2>/dev/null | grep -q ':5328 '; then
    echo "Error: port 5328 already in use (is arcaderd already running?)."
    exit 1
fi

if [ "$NESTED" = 1 ]; then
    missing=()
    command -v Xephyr >/dev/null || missing+=(xserver-xephyr)
    command -v openbox >/dev/null || missing+=(openbox)
    command -v picom  >/dev/null || missing+=(picom)
    if [ "${#missing[@]}" -gt 0 ]; then
        echo "Nested mode needs: ${missing[*]}"
        echo "Install:  sudo apt-get install -y ${missing[*]}"
        echo "Or run with --here to use your current desktop."
        exit 1
    fi
fi

echo "Building arcaderd..."
( cd "$ROOT/arcaderd" && cargo build )

echo "Enabling coin + time mode (originals restored on exit)..."
ORIG="$(python3 - "$DB" <<'PY'
import sqlite3, sys, json
con = sqlite3.connect(sys.argv[1])
keys = ["coinScreen.coinSlotEnabled", "coinScreen.timeModeEnabled", "coinScreen.minutesPerCoin"]
orig = {k: (con.execute("SELECT value FROM config WHERE key=?", (k,)).fetchone() or [None])[0] for k in keys}
con.execute("INSERT OR REPLACE INTO config(key,value) VALUES('coinScreen.coinSlotEnabled','true')")
con.execute("INSERT OR REPLACE INTO config(key,value) VALUES('coinScreen.timeModeEnabled','true')")
con.commit()
print(json.dumps(orig))
PY
)"

XEPHYR_PID=""; OPENBOX_PID=""; PICOM_PID=""; ARCADERD_PID=""; GODOT_PID=""
cleanup() {
    for pid in "$GODOT_PID" "$ARCADERD_PID" "$PICOM_PID" "$OPENBOX_PID" "$XEPHYR_PID"; do
        [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
    done
    python3 - "$DB" "$ORIG" <<'PY'
import sqlite3, sys, json
con = sqlite3.connect(sys.argv[1])
for k, v in json.loads(sys.argv[2]).items():
    if v is None:
        con.execute("DELETE FROM config WHERE key=?", (k,))
    else:
        con.execute("INSERT OR REPLACE INTO config(key,value) VALUES(?,?)", (k, v))
con.commit()
PY
    echo "Stopped and restored config."
}
trap cleanup EXIT INT TERM

if [ "$NESTED" = 1 ]; then
    DISPLAY_NUM=99
    while [ -e "/tmp/.X${DISPLAY_NUM}-lock" ]; do DISPLAY_NUM=$((DISPLAY_NUM - 1)); done
    echo "Starting nested X (Xephyr) on :$DISPLAY_NUM ($SCREEN_SIZE)..."
    Xephyr -ac -br -noreset -resizeable -screen "$SCREEN_SIZE" ":$DISPLAY_NUM" >/dev/null 2>&1 &
    XEPHYR_PID=$!
    export DISPLAY=":$DISPLAY_NUM"
    for _ in $(seq 1 40); do
        xset q >/dev/null 2>&1 && break
        sleep 0.25
    done
    openbox >/dev/null 2>&1 & OPENBOX_PID=$!
    picom >/dev/null 2>&1 & PICOM_PID=$!
    echo "Nested session up (Openbox + picom inside Xephyr)."
fi

mkdir -p "$DEV_XDG"
export XDG_RUNTIME_DIR="$DEV_XDG"

echo "Starting arcaderd..."
( cd "$ROOT/arcaderd" && exec ./target/debug/arcaderd ) &
ARCADERD_PID=$!

for _ in $(seq 1 30); do
    [ -S "$DEV_XDG/arcaderd.sock" ] && break
    sleep 0.5
done
[ -S "$DEV_XDG/arcaderd.sock" ] || { echo "arcaderd socket never appeared"; exit 1; }

sleep 1
add_time 600
echo
echo "Ready (600s). Pick a game; the countdown overlay shows over the emulator."
echo "Add more time:  scripts/dev-run.sh add 120"
echo "Ctrl+C to stop."
echo

godot --path "$ROOT/arcaderui" &
GODOT_PID=$!
wait "$GODOT_PID"
