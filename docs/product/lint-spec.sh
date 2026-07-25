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

# Arguments may be written relative to the CALLER's directory (the gate runs
# `docs/product/lint-spec.sh docs/product/specs/foo.md` from the repo root) while
# the script chdirs to its own. Resolve before the chdir, and fail loudly below
# on anything unreadable — an unresolvable path used to lint nothing and report ✓.
files=()
for a in "$@"; do
  case "$a" in
    /*) files+=("$a") ;;
     *) if [ -e "$a" ]; then files+=("$PWD/$a"); else files+=("$a"); fi ;;
  esac
done
cd "$(dirname "$0")"
[ ${#files[@]} -eq 0 ] && files=(specs/*.md)

# Seeded test users + test journal — scenarios name ROLES, not accounts.
# Both rosters are flagged: the current role-keyed accounts (2026-07-10) AND
# the retired legacy usernames, so stale names can't sneak into future specs.
USERS='manager[.]maya|editor[.]diana|sectioneditor[.]ana|sectioneditor[.]ravi|sectioneditor[.]omar|reviewer[.]julia|reviewer[.]paul|reviewer[.]amara|reviewer[.]adam|copyeditor[.]carla|copyeditor[.]sam|layouteditor[.]leo|proofreader[.]pia|author[.]alex|author[.]bea|assistant[.]rita|reader[.]rosa|rvaca|dbarnes|dbuskins|sberardo|minoue|jjanssen|phudson|amccrae|agallego|mfritz|svogt|gcox|shellier|cturner|skumar|atester|publicknowledge'

# ── Multi-app (G5) — forbidden-term list, built from APP-GLOSSARY.md at runtime ──
# Single home: the OMP/OPS columns of the glossary's "## 1. Vocabulary map" ARE
# the term list; this script never keeps its own copy. Extraction rules:
#   · §1 tables only (§2 capability names and §3 badge translation are meta);
#   · a cell starting with "—" is an absence, not a term;
#   · parentheticals / bold / quotes stripped, then split on → ; / , ;
#   · a term equal to any token of the OJS column is dropped (OPS "section
#     (unchanged)", "galley (unchanged)", "Copyeditor", the shared stage names…);
#   · prose fragments ("no default section") and terms carrying punctuation are
#     dropped — a forbidden term must be a plain word or phrase.
# Two match buckets (see the collision notes below):
#   EXACT — matched case-sensitively, in the glossary's own spelling.
#   CAP   — ordinary English words (press, series, catalog) whose lowercase form
#           is everyday spec prose ("press Submit"). Matched only as a
#           capitalized proper noun AND only mid-sentence, so the app term
#           ("the Press's masthead") is caught and the verb is not.
# EXEMPT — terms the glossary assigns to OMP/OPS that also name a real OJS thing
#           (Translator IS an OJS user group, registry/userGroups.xml). Flagging
#           them would be a false positive; the glossary row wants a fix instead.
GLOSSARY="APP-GLOSSARY.md"
GLOSS_AWK='
  BEGIN { split("press series catalog", o, " "); for (i in o) ORD[o[i]]=1
          split("Translator", e, " ");            for (i in e) EX[e[i]]=1 }
  /^## 2\./ { exit }                      # §1 only
  /^## 1\./ { in1=1; next }
  !in1 { next }
  /^\|/ {
    line=$0; gsub(/^\||\|$/,"",line)
    n=split(line, c, /\|/); if (n < 3) next
    for (i=1;i<=n;i++) gsub(/^[ \t]+|[ \t]+$/,"",c[i])
    if (c[1] ~ /^:?-+:?$/ || c[1] ~ /^OJS/) next          # separator / header
    bn=split(c[1], b, /→|;|\/|,/)                         # OJS-column tokens
    for (k=1;k<=bn;k++) { gsub(/\([^)]*\)/,"",b[k]); gsub(/^[ \t"*]+|[ \t".*]+$/,"",b[k]); base[tolower(b[k])]=1 }
    for (i=2;i<=3;i++) {                                  # OMP, OPS columns
      cell=c[i]; if (cell ~ /^—/ || cell == "") continue
      gsub(/\([^)]*\)/,"",cell); gsub(/\*\*/,"",cell); gsub(/"/,"",cell); gsub(/“|”/,"",cell)
      m=split(cell, t, /→|;|\/|,/)
      for (j=1;j<=m;j++) {
        term=t[j]; gsub(/^[ \t]+|[ \t.]+$/,"",term)
        if (term == "" || tolower(term) in base || term in EX) continue
        if (term ~ /^(no|one|not|same|unchanged|optional|different|plus|and) /) continue
        if (term !~ /^[A-Za-z][A-Za-z0-9'"'"' -]*$/) continue    # plain words only
        want = (term in ORD) ? "cap" : "exact"
        if (want != MODE) continue
        if (MODE == "cap") term = toupper(substr(term,1,1)) substr(term,2)
        if (!(term in seen)) { seen[term]=1; out = out (out=="" ? "" : "|") term }
      }
    }
  }
  END { print out }'
if [ -r "$GLOSSARY" ]; then
  FORBID_EXACT=$(awk -v MODE=exact "$GLOSS_AWK" "$GLOSSARY")
  FORBID_CAP=$(awk   -v MODE=cap   "$GLOSS_AWK" "$GLOSSARY")
else
  FORBID_EXACT=''; FORBID_CAP=''
  echo "! $GLOSSARY not readable — glossary term check skipped" >&2
fi

total=0
for f in "${files[@]}"; do
  if [ ! -r "$f" ]; then
    echo "✗ $f — not readable (path is resolved against the caller's directory)"
    total=$((total+1)); continue
  fi
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
  fbad=0
  if [ "$n" -gt 0 ]; then
    echo "✗ $f — $n leaky line(s)"
    echo "$count"
    total=$((total+n)); fbad=$((fbad+n))
  fi
  # ✓ is printed once, at the end of the per-file checks (below), so a file that
  # is leak-clean but fails a later check no longer reports ✓ and ✗ at once.

  # TEMPLATE rule 5 — whole-file term-density ceiling on attack-narrative
  # phrasing (deviations + footnotes INCLUDED: every downstream agent reads the
  # whole file, and accumulation is what trips the safeguard fallback — see the
  # 2026-07-22 flip forensics). State expected/observed/ledger-N instead;
  # mechanics live in probe reports. Ceiling 5: naming a feature like
  # "Log In As" once or twice is fine, a dossier is not.
  DENS_TERMS='bypass|ungated|impersonat|exploit|privilege escalat|log in as|still (answers|accepts|succeeds|grants|applies)|no server[- ]side (check|guard)|silently (grants|accepts|applie[sd])|hand-craft'
  dens=$(grep -oiE "$DENS_TERMS" "$f" | wc -l | tr -d ' ')
  if [ "$dens" -gt 5 ]; then
    echo "✗ $f — deviation-phrasing density $dens (ceiling 5, TEMPLATE rule 5)"
    grep -niE "$DENS_TERMS" "$f" | head -15 | sed 's/^/  /'
    total=$((total+dens)); fbad=$((fbad+dens))
  fi

  # ── G5 check 1 — app-badge syntax (MULTIAPP-PLAN §2 item 2) ────────────────
  # CANONICAL BADGE: {OJS OMP}
  #   · braces, never brackets;   · app names uppercase, exactly OJS|OMP|OPS;
  #   · single spaces, no commas/slashes;  · canonical order OJS OMP OPS;
  #   · positive list — the badge names the apps where the rule/row/bullet EXISTS;
  #   · no badge = all three apps, so {OJS OMP OPS} is a finding (say nothing).
  # A line is only inspected as a badge attempt when a {…}/[…] group holds
  # nothing but short alphabetic tokens (≤8 letters) and one of them is an app
  # name — that keeps route placeholders (`{submissionId}`) and brace-expanded
  # code anchors (`{useWorkflowConfigOJS,…}.js`) out of the check.
  badge=$(awk '
    /^[[:space:]]*<!--/, /-->[[:space:]]*$/ { next }
    {
      s=$0
      while (match(s, /[{\[][^}\]]*[}\]]/)) {
        g=substr(s, RSTART, RLENGTH); s=substr(s, RSTART+RLENGTH)
        open=substr(g,1,1); body=substr(g,2,length(g)-2)
        ntok=split(body, tk, /[ \t,\/;|+&-]+/); ok=1; hasapp=0
        for (i=1;i<=ntok;i++) {
          if (tk[i]=="") continue
          if (tk[i] !~ /^[A-Za-z]+$/ || length(tk[i])>8) { ok=0; break }
          u=toupper(tk[i]); if (u=="OJS"||u=="OMP"||u=="OPS") hasapp=1
        }
        if (!ok || !hasapp) continue                      # not a badge attempt
        why=""
        if (open != "{") why="use braces — {OJS OMP}, not [ … ]"
        else if (g !~ /^\{[A-Z][A-Z][A-Z]( [A-Z][A-Z][A-Z])*\}$/)
          why="canonical form is {OJS OMP}: uppercase names, single spaces, no commas or slashes"
        else {
          nn=split(body, ap, " "); prev=0
          for (i=1;i<=nn;i++) {
            rank=(ap[i]=="OJS"?1:(ap[i]=="OMP"?2:(ap[i]=="OPS"?3:0)))
            if (rank==0)      { why="unknown app name \"" ap[i] "\" (known: OJS OMP OPS)"; break }
            if (rank==prev)   { why="duplicate app \"" ap[i] "\""; break }
            if (rank<prev)    { why="list apps in canonical order OJS OMP OPS"; break }
            prev=rank
          }
          if (why=="" && nn==3) why="{OJS OMP OPS} is redundant — no badge already means all three apps"
        }
        if (why!="") { n++; printf "  %s:%d %s — %s\n", FILENAME, FNR, g, why }
      }
    }
    END { print n+0 > "/dev/stderr" }
  ' "$f" 2>/tmp/lint-badge.$$)
  bn=$(cat /tmp/lint-badge.$$); rm -f /tmp/lint-badge.$$
  if [ "$bn" -gt 0 ]; then
    echo "✗ $f — $bn malformed app badge(s)"
    echo "$badge"
    total=$((total+bn)); fbad=$((fbad+bn))
  fi

  # ── G5 check 2 — variation-stub match (MULTIAPP-PLAN §2 item 3) ────────────
  # In a "## App variations — OMP / OPS" section every override (a column-0
  # bullet/numbered item, or a table data row) must quote a 3–6-word stub of the
  # base rule it modifies, in straight double quotes, and that stub must still
  # occur in the spec body ABOVE the section. Edit the base text without editing
  # the override and the stub stops matching → loud failure instead of silent
  # drift. Comparison ignores markdown emphasis, line wrapping and case.
  # Escape hatch: unbulleted prose lines and indented sub-bullets are not
  # overrides and are never asked for a stub.
  stubs=$(awk '
    function norm(s) { gsub(/[*_`]/,"",s); gsub(/[ \t]+/," ",s)
                       sub(/^ /,"",s); sub(/ $/,"",s); return tolower(s) }
    /^## / { invar=($0 ~ /^## App variations/); tbl=0; next }
    !invar { body=body " " norm($0); next }
    /^[[:space:]]*<sup>/ || /^###/ { next }
    /^[[:space:]]*$/ { tbl=0; next }
    {
      isrow=0
      if ($0 ~ /^\|/) { tbl++; if (tbl<=2) next; if ($0 ~ /^\|[ :|-]*$/) next; isrow=1 }
      else if ($0 ~ /^([-*+] |[0-9]+\. )/) isrow=1
      if (!isrow) next
      why=""
      if (index($0, "\342\200\234") > 0 || index($0, "\342\200\235") > 0)
        why="quote the base-text stub in straight double quotes"
      else if (!match($0, /"[^"]+"/))
        why="override quotes no base-text stub (3–6 words in \"…\")"
      else {
        stub=substr($0, RSTART+1, RLENGTH-2); ns=norm(stub)
        w=split(ns, ww, " ")
        if (w<3 || w>6) why="stub is " w " word(s) — quote 3–6 words of the base text"
        else if (index(body, ns)==0) why="stub no longer occurs in the spec body above (silent drift — re-quote it)"
      }
      if (why!="") { n++; printf "  %s:%d %s — %s\n", FILENAME, FNR, substr($0,1,70), why }
    }
    END { print n+0 > "/dev/stderr" }
  ' "$f" 2>/tmp/lint-stub.$$)
  sn=$(cat /tmp/lint-stub.$$); rm -f /tmp/lint-stub.$$
  if [ "$sn" -gt 0 ]; then
    echo "✗ $f — $sn unanchored app-variation override(s)"
    echo "$stubs"
    total=$((total+sn)); fbad=$((fbad+sn))
  fi

  # ── G5 check 3 — glossary forbidden terms (MULTIAPP-PLAN §2 item 1) ────────
  # Spec BODIES are written in OJS vocabulary; readers substitute via
  # APP-GLOSSARY.md. An OMP/OPS term in the body means the spec is translating
  # inline — the thing the glossary exists to kill. Same body scope as the leak
  # check, plus "## App variations", which necessarily speaks OMP/OPS.
  if [ -n "$FORBID_EXACT$FORBID_CAP" ]; then
    gloss=$(awk -v EX="$FORBID_EXACT" -v CAP="$FORBID_CAP" '
      /^## Reference/ { exit }
      /^## (Known deviations|Open questions|App variations)/ { skip=1; next }
      /^## / { skip=0; section=$0; sub(/^## /,"",section) }
      skip { next }
      /^[[:space:]]*<sup>/ { next }
      /^[[:space:]]*<!--/, /-->[[:space:]]*$/ { next }
      {
        term=""
        if (EX  != "" && match($0, "(^|[^A-Za-z0-9_-])(" EX ")($|[^A-Za-z0-9_-])"))
          term=substr($0, RSTART, RLENGTH)
        # ordinary-English words: proper-noun form only, and never sentence-initial
        # (the guard char is the preceding mid-sentence character — trimmed off
        # the reported term below).
        else if (CAP != "" && match($0, "[a-z,;:)\"][ ]+(" CAP ")($|[^A-Za-z0-9_-])")) {
          term=substr($0, RSTART, RLENGTH); sub(/^.[ ]+/, "", term)
        }
        if (term != "") {
          gsub(/^[^A-Za-z]+|[^A-Za-z]+$/, "", term)
          n++; printf "  %s:%d [%s] \"%s\" — OMP/OPS term in body text; write the OJS term (APP-GLOSSARY.md) and badge or vary instead\n", FILENAME, FNR, section, term
        }
      }
      END { print n+0 > "/dev/stderr" }
    ' "$f" 2>/tmp/lint-gloss.$$)
    gn=$(cat /tmp/lint-gloss.$$); rm -f /tmp/lint-gloss.$$
    if [ "$gn" -gt 0 ]; then
      echo "✗ $f — $gn non-OJS vocabulary line(s)"
      echo "$gloss"
      total=$((total+gn)); fbad=$((fbad+gn))
    fi
  fi

  [ "$fbad" -eq 0 ] && echo "✓ $f"
done

[ $total -eq 0 ] && exit 0
echo "TOTAL: $total finding(s). Body text is for PO/QA — move mechanism, probe evidence and code symbols to <sup> footnotes / Reference (TEMPLATE.md rules 1 & 4); keep bodies in OJS vocabulary and put app deltas in badges / App variations (MULTIAPP-PLAN.md §2, APP-GLOSSARY.md)."
exit 1
