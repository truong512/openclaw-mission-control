#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/local-app.sh"
local_app_init

usage() {
  cat <<'EOF'
Usage: ./stop.sh [options]

Stop locally running Mission Control services.

By default this stops backend, frontend, and the RQ worker only. Postgres and
Redis containers are left running for faster restarts.

Options:
  --infra       Also stop Postgres and Redis containers
  --volumes     With --infra, remove Docker volumes (deletes Postgres data)
  -h, --help    Show this help
EOF
}

STOP_INFRA=0
REMOVE_VOLUMES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --infra)
      STOP_INFRA=1
      shift
      ;;
    --volumes)
      STOP_INFRA=1
      REMOVE_VOLUMES=1
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

local_app_info "Stopping backend, frontend, and RQ worker..."
local_app_stop_services

if [[ "$STOP_INFRA" -eq 1 ]]; then
  local_app_require_docker
  if [[ "$REMOVE_VOLUMES" -eq 1 ]]; then
    local_app_info "Stopping Postgres/Redis and removing volumes..."
  else
    local_app_info "Stopping Postgres and Redis..."
  fi
  local_app_stop_infra "$REMOVE_VOLUMES"
fi

local_app_info "Done."
