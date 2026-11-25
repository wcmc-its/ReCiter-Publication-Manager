#!/usr/bin/env bash
# Runner for the homonym-rejection backfill. Fetches the ReCiter admin key from the
# Kubernetes secret itself so no credential ever appears on a command line, and pins the
# ledger to a durable path outside the git worktree (a worktree can be removed; the ledger
# is the only reversal record for these writes).
#
# Usage:  scripts/run-homonym-backfill.sh            # dry run
#         scripts/run-homonym-backfill.sh --apply    # write
#
# Requires an active port-forward:
#   kubectl -n reciter port-forward svc/reciter-prod 9082:80
set -euo pipefail

LEDGER_DIR="$HOME/Dropbox/Projects/ReCiter Research/analysis/homonym_rejection_backfill"
mkdir -p "$LEDGER_DIR"

RECITER_API_BASE_URL="${RECITER_API_BASE_URL:-http://localhost:9082}"
export RECITER_API_BASE_URL
RECITER_API_KEY="$(kubectl -n reciter get secret reciter-secrets -o jsonpath='{.data.ADMIN_API_KEY}' | base64 -d)"
export RECITER_API_KEY

curl -sf -o /dev/null "$RECITER_API_BASE_URL/reciter/ping" \
  || { echo "ReCiter not reachable at $RECITER_API_BASE_URL — start the port-forward first" >&2; exit 1; }

exec node "$(dirname "$0")/backfill-homonym-rejections.mjs" \
  --ledger "$LEDGER_DIR/backfill.jsonl" "$@"
