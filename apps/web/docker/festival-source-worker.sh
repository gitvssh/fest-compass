#!/bin/sh
set -eu
umask 077
: "${SOURCE_DATA_DIR:?SOURCE_DATA_DIR must be set}"
case "$SOURCE_DATA_DIR" in /*) ;; *) exit 64 ;; esac
mkdir -p "$SOURCE_DATA_DIR"
export SOURCE_WORKER_LOCKED=1
exec flock --no-fork -n -E 75 "$SOURCE_DATA_DIR/worker.lock" node "${SOURCE_WORKER_PATH:-/app/festival-source-worker.cjs}" "$@"
