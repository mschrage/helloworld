#!/usr/bin/env bash
# Provisions the sandbox: install dependencies and bring up the Vite dev server.
# Niteshift runs this on first boot and on any resume that lost its processes.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PORT="${PORT:-3000}"
LOG="${NITESHIFT_LOG_FILE:-/tmp/vellum-dev.log}"

echo "[setup] installing dependencies"
npm install --no-audit --no-fund

# Nothing to do if a server already holds the port (resume with processes intact).
if curl -sf -o /dev/null --max-time 2 "http://localhost:${PORT}/"; then
  echo "[setup] dev server already listening on ${PORT}"
  exit 0
fi

echo "[setup] starting dev server on ${PORT}"
setsid nohup npm run dev -- --port "${PORT}" --strictPort >>"${LOG}" 2>&1 &

for _ in $(seq 1 60); do
  if curl -sf -o /dev/null --max-time 2 "http://localhost:${PORT}/"; then
    echo "[setup] dev server ready at http://localhost:${PORT}"
    exit 0
  fi
  sleep 1
done

echo "[setup] dev server did not come up within 60s; see ${LOG}" >&2
exit 1
