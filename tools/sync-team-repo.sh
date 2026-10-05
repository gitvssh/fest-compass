#!/usr/bin/env bash
# Make a checkout of the team repository (travel-resolver/pick-d-day) hold exactly this repository's committed tree (HEAD).
# It only stages the change: review it and commit on a dedicated branch there, then publish.
# Usage: tools/sync-team-repo.sh <team checkout or worktree>
set -euo pipefail
src=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
dst=$(cd "${1:?team checkout path required}" && git rev-parse --show-toplevel)
[ "$src" != "$dst" ] || { echo "target is this repository" >&2; exit 1; }
[ -z "$(git -C "$dst" status --porcelain)" ] || { echo "target has uncommitted changes" >&2; exit 1; }
git -C "$dst" rm -r -q --ignore-unmatch -- .
git -C "$src" archive --format=tar HEAD | tar -x -C "$dst"
git -C "$dst" add -A
sha=$(git -C "$src" rev-parse --short HEAD)
echo "Staged the tree of gitvssh/fest-compass@$sha in $dst."
echo "Review: git -C \"$dst\" diff --cached --stat"
echo "Commit: chore: sync pickDday source from gitvssh/fest-compass@$sha"
