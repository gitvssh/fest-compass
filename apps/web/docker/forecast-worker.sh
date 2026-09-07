#!/bin/sh
set -eu
umask 077
: "${FORECAST_DATA_DIR:?FORECAST_DATA_DIR must be set}"
case "$FORECAST_DATA_DIR" in /*) ;; *) exit 64 ;; esac
mkdir -p "$FORECAST_DATA_DIR"
export FORECAST_WORKER_LOCKED=1
# Kernel-owned process lock survives neither a crash nor a container restart.
# No stale lock-file deletion, TTL guessing, additional RBAC or public write endpoint.
exec flock --no-fork -n -E 75 "$FORECAST_DATA_DIR/worker.lock" node "${FORECAST_WORKER_PATH:-/app/forecast-worker.cjs}" "$@"
