#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/local-app.sh"
local_app_init

usage() {
  cat <<'EOF'
Usage: ./start.sh [options]

Start Mission Control locally (Postgres/Redis in Docker; backend, frontend,
and RQ worker on the host).

Options:
  --no-infra    Do not start Postgres/Redis (fail if they are not already up)
  -h, --help    Show this help

Postgres/Redis are read from backend/.env (DATABASE_URL, RQ_REDIS_URL). If they
are already running, Docker is not required.

After startup:
  UI:      http://localhost:3000
  Health:  http://localhost:8000/healthz

Logs and pid files:
  ~/.local/state/openclaw-mission-control/
EOF
}

START_INFRA=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-infra)
      START_INFRA=0
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cd "$REPO_ROOT"
local_app_require_files
local_app_require_uv
local_app_require_node

local_app_load_ports
local_app_ensure_layout

local_app_ensure_infra "$START_INFRA"

local_app_info "Starting backend, frontend, and RQ worker..."
local_app_start_services

cat <<SUMMARY

Mission Control is starting locally.

Access URLs:
- Frontend: http://localhost:${FRONTEND_PORT}
- Backend:  http://localhost:${BACKEND_PORT}/healthz

Logs:
- ${LOG_DIR}/backend.log
- ${LOG_DIR}/frontend.log
- ${LOG_DIR}/rq-worker.log

Stop with:
  ./stop.sh
SUMMARY
