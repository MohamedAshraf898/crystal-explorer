#!/bin/bash
# Double-click this file (macOS) to run the building explorer locally.
# Browsers don't run JavaScript modules from file://, so this starts a tiny
# local web server with the Python that ships with macOS and opens the page.
cd "$(dirname "$0")"
PORT=8080
while lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
echo "Building explorer running at http://localhost:$PORT  (close this window to stop)"
(sleep 1 && open "http://localhost:$PORT") &
python3 -m http.server $PORT
