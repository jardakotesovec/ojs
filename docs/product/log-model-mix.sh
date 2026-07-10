#!/usr/bin/env bash
# log-model-mix.sh — append a completed subagent's model provenance to the
# "Model-fallback log" section of PROGRESS.md (RUNBOOK Model discipline: the
# completion spot-check). That section must stay LAST in PROGRESS.md — this
# script appends to end-of-file.
#
# Usage: docs/product/log-model-mix.sh <agent-transcript.jsonl> <feature> <class> <label>
#   class: authoring | verification | probe
#   label: short agent id, e.g. spec-author, verify-denials, probe-wizard-roles
#
# Log EVERY completed subagent, clean or flipped — clean rows are the
# denominators that make per-class flip rates meaningful.
set -eu
f=$1; feature=$2; class=$3; label=$4
case "$class" in authoring|verification|probe) ;; *) echo "class must be authoring|verification|probe" >&2; exit 1;; esac
[ -f "$f" ] || { echo "no transcript: $f" >&2; exit 1; }

msgs=$(grep '"type":"assistant"' "$f" || true)
total=$(printf '%s\n' "$msgs" | grep -c '"type":"assistant"' || true)
fable=$(printf '%s\n' "$msgs" | grep -c '"model":"claude-fable' || true)
opus=$(printf '%s\n' "$msgs" | grep -c '"model":"claude-opus' || true)
other=$((total - fable - opus))
flip=$(printf '%s\n' "$msgs" | grep -n '"model":"claude-opus' | head -1 | cut -d: -f1 || true)

if [ -n "$flip" ] && [ "$fable" -gt 0 ]; then status="FLIPPED@${flip}/${total}"
elif [ -n "$flip" ]; then status="all-opus"
else status="clean"; fi

log="$(cd "$(dirname "$0")" && pwd)/PROGRESS.md"
printf '| %s | %s | %s | %s | %s | %s | %s | %s |\n' \
  "$(date +%F)" "$feature" "$class" "$label" "$fable" "$opus" "$other" "$status" >> "$log"
echo "$label: $status (fable=$fable opus=$opus other=$other)"
