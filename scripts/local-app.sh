#!/usr/bin/env bash

# Shared helpers for ./start.sh and ./stop.sh (local development mode).

local_app_init() {
  REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
  STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/openclaw-mission-control"
  LOG_DIR="$STATE_DIR/logs"
  PID_DIR="$STATE_DIR/pids"
}

local_app_info() {
  printf '[INFO] %s\n' "$*"
}

local_app_warn() {
  printf '[WARN] %s\n' "$*" >&2
}

local_app_error() {
  printf '[ERROR] %s\n' "$*" >&2
}

local_app_die() {
  local_app_error "$@"
  exit 1
}

local_app_ensure_layout() {
  mkdir -p "$LOG_DIR" "$PID_DIR"
}

local_app_load_ports() {
  BACKEND_PORT=8000
  FRONTEND_PORT=3000

  if [[ -f "$REPO_ROOT/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$REPO_ROOT/.env"
    set +a
  fi

  BACKEND_PORT="${BACKEND_PORT:-8000}"
  FRONTEND_PORT="${FRONTEND_PORT:-3000}"
}

local_app_require_files() {
  [[ -f "$REPO_ROOT/compose.yml" ]] || local_app_die "Missing compose.yml in repository root."
  [[ -f "$REPO_ROOT/.env" ]] || local_app_die "Missing .env. Copy .env.example to .env first."
  [[ -f "$REPO_ROOT/backend/.env" ]] || local_app_warn "Missing backend/.env. Copy backend/.env.example to backend/.env."
}

local_app_bootstrap_docker_path() {
  local dir
  for dir in /usr/local/bin /opt/homebrew/bin /Applications/Docker.app/Contents/Resources/bin; do
    if [[ -x "$dir/docker" ]]; then
      PATH="$dir:$PATH"
      export PATH
      return 0
    fi
  done
}

local_app_docker_available() {
  local_app_bootstrap_docker_path
  command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

local_app_require_docker() {
  local_app_bootstrap_docker_path
  command -v docker >/dev/null 2>&1 || local_app_die "Docker is required to start Postgres/Redis containers."
  docker compose version >/dev/null 2>&1 || local_app_die "Docker Compose v2 is required ('docker compose')."
}

local_app_load_backend_infra_env() {
  DB_HOST="localhost"
  DB_PORT="5432"
  REDIS_HOST="localhost"
  REDIS_PORT="6379"

  if [[ ! -f "$REPO_ROOT/backend/.env" ]]; then
    return 0
  fi

  local database_url=""
  local redis_url=""
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/backend/.env"
  set +a
  database_url="${DATABASE_URL:-}"
  redis_url="${RQ_REDIS_URL:-}"

  if [[ "$database_url" =~ @([^:/]+):?([0-9]*) ]]; then
    DB_HOST="${BASH_REMATCH[1]}"
    DB_PORT="${BASH_REMATCH[2]:-5432}"
  fi

  if [[ "$redis_url" =~ redis://([^:/]+):?([0-9]*) ]]; then
    REDIS_HOST="${BASH_REMATCH[1]}"
    REDIS_PORT="${BASH_REMATCH[2]:-6379}"
  fi
}

local_app_port_open() {
  local host="$1"
  local port="$2"

  if command -v nc >/dev/null 2>&1; then
    nc -z "$host" "$port" >/dev/null 2>&1
    return
  fi

  (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1
}

local_app_infra_reachable() {
  local_app_load_backend_infra_env
  local_app_port_open "$DB_HOST" "$DB_PORT" && local_app_port_open "$REDIS_HOST" "$REDIS_PORT"
}

local_app_ensure_infra() {
  local start_docker="${1:-1}"

  if local_app_infra_reachable; then
    local_app_info "Using existing Postgres (${DB_HOST}:${DB_PORT}) and Redis (${REDIS_HOST}:${REDIS_PORT})."
    return 0
  fi

  if [[ "$start_docker" -eq 0 ]]; then
    local_app_die "Postgres/Redis are not reachable and --no-infra was set. Start them manually first."
  fi

  if ! local_app_docker_available; then
    local_app_die "Postgres/Redis are not reachable and Docker is unavailable. Start them manually (see backend/.env), install Docker Desktop, or run ./start.sh --no-infra once they are up."
  fi

  local_app_info "Starting Postgres and Redis via Docker..."
  local_app_start_infra
}

local_app_require_uv() {
  export PATH="$HOME/.local/bin:$PATH"
  command -v uv >/dev/null 2>&1 || local_app_die "uv is required. Install from https://docs.astral.sh/uv/"
}

local_app_sync_backend() {
  local_app_info "Syncing backend dependencies..."
  (
    cd "$REPO_ROOT/backend"
    export PATH="$HOME/.local/bin:$PATH"
    uv sync --extra dev
  )
}

local_app_wait_backend_health() {
  local i url="http://127.0.0.1:${BACKEND_PORT}/healthz"
  local log_file="${LOG_DIR}/backend.log"

  local_app_info "Waiting for backend health at $url ..."
  for ((i = 1; i <= 30; i++)); do
    if curl -sf "$url" >/dev/null 2>&1; then
      local_app_info "Backend is healthy at $url"
      return 0
    fi
    sleep 0.5
  done

  local_app_warn "Backend did not respond at $url. Check ${log_file}"
  if [[ -f "$log_file" ]]; then
    local_app_warn "Last lines from backend.log:"
    tail -n 10 "$log_file" >&2 || true
  fi
  return 1
}

local_app_require_node() {
  bash "$REPO_ROOT/scripts/with_node.sh" --check
}

local_app_start_infra() {
  (
    cd "$REPO_ROOT"
    docker compose -f compose.yml --env-file .env up -d db redis
  )
}

local_app_stop_infra() {
  local remove_volumes="${1:-0}"

  (
    cd "$REPO_ROOT"
    docker compose -f compose.yml --env-file .env stop db redis
    if [[ "$remove_volumes" -eq 1 ]]; then
      docker compose -f compose.yml --env-file .env rm -f -v db redis
    fi
  )
}

local_app_read_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' <"$pid_file"
  fi
}

local_app_is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

local_app_process_command() {
  ps -p "$1" -o command= 2>/dev/null | sed 's/^ *//' || true
}

local_app_pid_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

local_app_pid_in_repo() {
  local pid="$1"
  local cmd cwd

  cmd="$(local_app_process_command "$pid")"
  if [[ -n "$cmd" && "$cmd" == *"$REPO_ROOT"* ]]; then
    return 0
  fi

  cwd="$(local_app_pid_cwd "$pid")"
  [[ -n "$cwd" && "$cwd" == "$REPO_ROOT"* ]]
}

local_app_stop_repo_process() {
  local pid="$1"
  local parent next_parent

  [[ -n "$pid" ]] || return 0

  parent="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ' || true)"

  if local_app_is_running "$pid"; then
    local_app_kill_tree "$pid"
    local_app_wait_tree_dead "$pid"
  fi

  while [[ -n "$parent" && "$parent" -gt 1 ]]; do
    if ! local_app_pid_in_repo "$parent"; then
      break
    fi
    if local_app_is_running "$parent"; then
      local_app_kill_tree "$parent"
      local_app_wait_tree_dead "$parent"
    fi
    next_parent="$(ps -p "$parent" -o ppid= 2>/dev/null | tr -d ' ' || true)"
    parent="$next_parent"
  done
}

local_app_pids_on_port() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | sort -u
}

local_app_kill_tree() {
  local pid="$1"
  local child

  [[ -n "$pid" ]] || return 0

  while read -r child; do
    [[ -n "$child" ]] || continue
    local_app_kill_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)

  if local_app_is_running "$pid"; then
    kill -TERM "$pid" 2>/dev/null || true
  fi
}

local_app_wait_tree_dead() {
  local pid="$1"
  local i

  [[ -n "$pid" ]] || return 0

  for ((i = 1; i <= 25; i++)); do
    if ! local_app_is_running "$pid"; then
      return 0
    fi
    sleep 0.2
  done

  local_app_kill_tree "$pid"
  kill -KILL "$pid" 2>/dev/null || true
}

local_app_stop_port() {
  local name="$1"
  local port="$2"
  local pid

  while read -r pid; do
    [[ -n "$pid" ]] || continue
    if local_app_pid_in_repo "$pid"; then
      local_app_info "Stopping $name on port $port (pid $pid)"
      local_app_stop_repo_process "$pid"
    fi
  done < <(local_app_pids_on_port "$port" || true)
}

local_app_stop_matching() {
  local name="$1"
  local pattern="$2"
  local pid cmd

  while read -r pid; do
    [[ -n "$pid" ]] || continue
    if ! local_app_pid_in_repo "$pid"; then
      continue
    fi
    cmd="$(local_app_process_command "$pid")"
    if [[ "$cmd" == *"$pattern"* ]]; then
      local_app_info "Stopping $name (pid $pid)"
      local_app_stop_repo_process "$pid"
    fi
  done < <(pgrep -f "$pattern" 2>/dev/null || true)
}

local_app_assert_port_free() {
  local name="$1"
  local port="$2"
  local pid

  while read -r pid; do
    [[ -n "$pid" ]] || continue
    if local_app_pid_in_repo "$pid"; then
      local_app_warn "$name port $port is in use by stale process (pid $pid); stopping it"
      local_app_stop_repo_process "$pid"
    else
      local_app_die "$name port $port is already in use by pid $pid (outside this repo)."
    fi
  done < <(local_app_pids_on_port "$port" || true)
}

local_app_start_process() {
  local name="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  local pid
  pid="$(local_app_read_pid "$pid_file")"
  if local_app_is_running "$pid"; then
    local_app_info "$name already running (pid $pid)"
    return 0
  fi

  rm -f "$pid_file"
  nohup "$@" >"$log_file" 2>&1 &
  echo $! >"$pid_file"

  sleep 1
  pid="$(local_app_read_pid "$pid_file")"
  if ! local_app_is_running "$pid"; then
    rm -f "$pid_file"
    local_app_die "$name failed to start. Check $log_file"
  fi

  local_app_info "Started $name (pid $pid, log: $log_file)"
}

local_app_stop_process() {
  local name="$1"
  local pid_file="$2"

  local pid
  pid="$(local_app_read_pid "$pid_file")"
  if ! local_app_is_running "$pid"; then
    rm -f "$pid_file"
    return 0
  fi

  local_app_stop_repo_process "$pid"
  rm -f "$pid_file"
  local_app_info "Stopped $name (pid $pid)"
}

local_app_start_services() {
  local_app_sync_backend

  local_app_assert_port_free backend "$BACKEND_PORT"
  local_app_assert_port_free frontend "$FRONTEND_PORT"

  # Use `python -m uvicorn` so the reload worker stays on the project venv
  # (the .venv/bin/uvicorn wrapper can retain stale shebangs after moving the repo).
  local_app_start_process backend "$PID_DIR/backend.pid" "$LOG_DIR/backend.log" \
    bash -lc "cd \"$REPO_ROOT/backend\" && export PATH=\"\$HOME/.local/bin:\$PATH\" && exec uv run python -m uvicorn app.main:app --reload --host 0.0.0.0 --port \"$BACKEND_PORT\""

  local_app_wait_backend_health || true

  local_app_start_process frontend "$PID_DIR/frontend.pid" "$LOG_DIR/frontend.log" \
    bash "$REPO_ROOT/scripts/with_node.sh" --cwd "$REPO_ROOT/frontend" \
    npm run dev -- --hostname 0.0.0.0 --port "$FRONTEND_PORT"

  local_app_start_process rq-worker "$PID_DIR/rq-worker.pid" "$LOG_DIR/rq-worker.log" \
    bash -lc "cd \"$REPO_ROOT/backend\" && export PATH=\"\$HOME/.local/bin:\$PATH\" && exec uv run python ../scripts/rq worker"
}

local_app_stop_services() {
  local_app_load_ports

  local_app_stop_process rq-worker "$PID_DIR/rq-worker.pid"
  local_app_stop_process frontend "$PID_DIR/frontend.pid"
  local_app_stop_process backend "$PID_DIR/backend.pid"

  local_app_stop_matching rq-worker "$REPO_ROOT/scripts/rq worker"
  local_app_stop_port backend "$BACKEND_PORT"
  local_app_stop_port frontend "$FRONTEND_PORT"
  local_app_stop_matching backend "$REPO_ROOT/backend/.venv/bin/uvicorn app.main:app"
  local_app_stop_matching backend "$REPO_ROOT/backend.*uv run uvicorn app.main:app"
}
