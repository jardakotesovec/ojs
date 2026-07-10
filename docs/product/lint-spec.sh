#!/usr/bin/env bash
# lint-spec.sh — leak check for PO/QA-facing spec bodies (TEMPLATE.md rules 1 & 4).
#
# Scans every section a product owner reads (everything above "## Reference",
# excluding Known deviations / Open questions, which may stay technical, and
# excluding <sup> footnote lines, where provenance belongs) for technical
# leakage: code symbols, routes/URLs, HTTP codes, probe evidence, seeded
# usernames. The calibrated exemplars (tasks-discussions, media-files) pass
# with 0; a new spec must be clean before it proceeds to test authoring
# (RUNBOOK per-feature loop).
#
# Usage: docs/product/lint-spec.sh [specs/foo.md ...]   # default: all specs
# Exit:  0 = all clean · 1 = violations (printed as file:line [section] text)

set -u
cd "$(dirname "$0")"

files=("$@")
[ ${#files[@]} -eq 0 ] && files=(specs/*.md)

# Seeded test users + test journal — scenarios name ROLES, not accounts.
# Both rosters are flagged: the current role-keyed accounts (2026-07-10) AND
# the retired legacy usernames, so stale names can't sneak into future specs.
USERS='manager[.]maya|editor[.]diana|sectioneditor[.]ana|sectioneditor[.]ravi|sectioneditor[.]omar|reviewer[.]julia|reviewer[.]paul|reviewer[.]amara|reviewer[.]adam|copyeditor[.]carla|copyeditor[.]sam|layouteditor[.]leo|proofreader[.]pia|author[.]alex|author[.]bea|assistant[.]rita|reader[.]rosa|rvaca|dbarnes|dbuskins|sberardo|minoue|jjanssen|phudson|amccrae|agallego|mfritz|svogt|gcox|shellier|cturner|skumar|atester|publicknowledge'

total=0
for f in "${files[@]}"; do
  count=$(awk -v USERS="$USERS" '
    /^## Reference/ { exit }
    /^## (Known deviations|Open questions)/ { skip=1; next }
    /^## / { skip=0; section=$0; sub(/^## /,"",section) }
    skip { next }
    /^[[:space:]]*<sup>/ { next }        # footnotes = provenance, allowed
    /^[[:space:]]*<!--/, /-->[[:space:]]*$/ { next }
    {
      hit = 0
      if ($0 ~ /::/) hit=1                                       # Class::method
      else if ($0 ~ /\<(GET|POST|PUT|DELETE) \//) hit=1          # verb + route
      else if ($0 ~ /\/api\//) hit=1                             # API paths
      else if ($0 ~ /\<(30[12]|40[0-9]|422|500)\>/) hit=1        # HTTP codes
      else if ($0 ~ /live[- ]probed?/) hit=1                     # probe evidence
      else if ($0 ~ /\?[a-zA-Z]+=/) hit=1                        # query params
      else if ($0 ~ /`\/[a-zA-Z{]/) hit=1                        # `/url/path`
      # seeded accounts — portable word boundary: BSD awk (macOS) lacks \< \>,
      # which silently disabled this check when written as "\\<(" USERS ")\\>".
      else if ($0 ~ ("(^|[^[:alnum:]._-])(" USERS ")($|[^[:alnum:]._-])")) hit=1
      else if ($0 ~ /\.(php|vue|tpl)\>/) hit=1                   # file names
      else if ($0 ~ /`[a-z]+[A-Z][a-zA-Z]*`?/) hit=1             # `camelCase`
      # Settings section legitimately names config vars / toggles:
      if (hit && section ~ /^Settings/ &&
          ($0 ~ /config\.inc\.php/ || ($0 ~ /`[a-z]+[A-Z][a-zA-Z]*`/ && $0 !~ /::|\/api\/|live[- ]probed?/)))
        hit=0
      if (hit) { n++; printf "  %s:%d [%s] %s\n", FILENAME, FNR, section, substr($0,1,110) }
    }
    END { print n+0 > "/dev/stderr" }
  ' "$f" 2>/tmp/lint-count.$$)
  n=$(cat /tmp/lint-count.$$); rm -f /tmp/lint-count.$$
  if [ "$n" -gt 0 ]; then
    echo "✗ $f — $n leaky line(s)"
    echo "$count"
    total=$((total+n))
  else
    echo "✓ $f"
  fi
done

[ $total -eq 0 ] && exit 0
echo "TOTAL: $total leaky lines. Body text is for PO/QA — move mechanism, probe evidence and code symbols to <sup> footnotes / Reference (TEMPLATE.md rules 1 & 4)."
exit 1
