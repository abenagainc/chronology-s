#!/usr/bin/env bash
# Chronology S — one command: verify + screenshot.
#
#   ./check.sh            verify against a local server on :8012
#   ./check.sh live       verify against the deployed site
#
# Runs, in order:
#   1. node verify.js          — engine maths, CRUD, published JDN references
#   2. node audit_ui.js        — palette tokens, overflow, clipping, contrast
#   3. node verify_browser.js  — REAL rendered geometry (needs CDP on :9223)
#   4. node shot.js <url>      — screenshot to /tmp/chronoS.png
#
# If the CDP Chrome isn't running, step 3 says so and the rest still runs.
set -uo pipefail
cd "$(dirname "$0")"

URL="${1:-http://127.0.0.1:8012/index.html}"
OUT="${2:-/tmp/chronoS.png}"
fail=0

line() { printf '\n\033[1m%s\033[0m\n' "$*"; }

line "1/4  engine + CRUD (jsdom)"
node verify.js || fail=1

line "2/4  UI audit (real browser)"
if node audit_ui.js "$URL" 2>&1 | tail -6; then :; else fail=1; fi

line "3/4  rendered geometry (real browser)"
node verify_browser.js 2>&1 | tail -12 || fail=1

line "4/4  screenshot -> $OUT"
node shot.js "$URL" "$OUT" 2>&1 | tail -2

line "result"
if [ "$fail" = 0 ]; then echo "PASS"; else echo "FAIL"; fi
exit $fail
