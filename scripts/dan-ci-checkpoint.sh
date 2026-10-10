#!/usr/bin/env bash
# Dispatch a DAN CI checkpoint for the current branch.
# Usage: scripts/dan-ci-checkpoint.sh [full|verify|checkpoint]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SUITE="${1:-full}"
case "${SUITE}" in
  full|verify|checkpoint) ;;
  *)
    echo "usage: $0 [full|verify|checkpoint]" >&2
    exit 1
    ;;
esac

BRANCH="$(git branch --show-current)"
if [[ -z "${BRANCH}" ]]; then
  echo "detached HEAD: checkout a branch before requesting a CI checkpoint" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI required to dispatch CI" >&2
  exit 1
fi

SHA="$(git rev-parse HEAD)"
echo "Checking for in-flight CI on ${BRANCH} @ ${SHA}"
if gh run list --workflow ci.yml --branch "${BRANCH}" --limit 20 \
  --json status,headSha,databaseId,url \
  --jq ".[] | select(.headSha==\"${SHA}\" and (.status==\"in_progress\" or .status==\"queued\")) | .url" \
  | grep -q .; then
  echo "A CI run for this SHA is already queued/in progress; not dispatching a duplicate." >&2
  gh run list --workflow ci.yml --branch "${BRANCH}" --limit 5
  exit 0
fi

echo "Dispatching CI workflow_dispatch suite=${SUITE} on ${BRANCH}"
gh workflow run ci.yml --ref "${BRANCH}" -f "suite=${SUITE}"
echo "Track with: gh run list --workflow=ci.yml --branch ${BRANCH} --limit 5"
