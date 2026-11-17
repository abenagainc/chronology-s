#!/usr/bin/env bash
# Serve the Chronology Tool S UI locally.
#   ./serve.sh          -> http://127.0.0.1:8012
#   ./serve.sh 9000     -> custom port
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8012}"
echo "Chronology Tool S → http://127.0.0.1:${PORT}"
echo "pages: index.html (timeline) · calendars.html · events.html · checks.html"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
