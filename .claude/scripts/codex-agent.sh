#!/usr/bin/env bash
# codex-agent.sh - run one game-team role as a non-interactive Codex worker.
# Usage: bash .claude/scripts/codex-agent.sh AGENT [--sandbox read-only|workspace-write]
#        [--task-file PATH] [--dry-run]; otherwise the brief comes from stdin.
# Exit: worker status, 2 invalid input/setup, 3 nested worker, 4 missing artifact.

if [ "${CCGS_CODEX_WORKER:-}" = 1 ]; then
  echo 'codex-agent: a Codex worker cannot start another agent; name <agent> and the question in your report instead.' >&2
  exit 3
fi

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd) || exit 2
cd "$ROOT" || exit 2
SANDBOX=read-only
TASK_FILE=''
DRY_RUN=no
AGENT=''
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    --sandbox|--task-file)
      [ $# -ge 2 ] || { echo "codex-agent: $1 needs a value" >&2; exit 2; }
      if [ "$1" = --sandbox ]; then SANDBOX="$2"; else TASK_FILE="$2"; fi
      shift 2 ;;
    --dry-run) DRY_RUN=yes; shift ;;
    -*) echo "codex-agent: unknown flag: $1" >&2; exit 2 ;;
    *)
      [ -z "$AGENT" ] || { echo "codex-agent: unexpected argument: $1" >&2; exit 2; }
      AGENT="$1"; shift ;;
  esac
done
if [[ ! "$AGENT" =~ ^[a-z0-9][a-z0-9-]*$ ]] || [ ! -f ".claude/agents/$AGENT.md" ]; then
  echo "codex-agent: invalid or unknown agent '$AGENT'; see valid names with: ls .claude/agents" >&2
  exit 2
fi
case "$SANDBOX" in
  read-only|workspace-write) ;;
  *) echo "codex-agent: bad sandbox '$SANDBOX'; use read-only or workspace-write" >&2; exit 2 ;;
esac
if [ "$SANDBOX" = workspace-write ] && ! awk '
  NR == 1 && /^---$/ { front=1; next }
  front && /^---$/ { exit }
  front && /^tools:/ { print }
' ".claude/agents/$AGENT.md" | grep -qE '\b(Write|Edit)\b'; then
  echo "codex-agent: $AGENT has no Write/Edit tools; run it with --sandbox read-only" >&2
  exit 2
fi
if [ -n "$TASK_FILE" ]; then
  [ -f "$TASK_FILE" ] || { echo "codex-agent: task file not found: $TASK_FILE" >&2; exit 2; }
  BRIEF=$(cat -- "$TASK_FILE") || exit 2
else
  BRIEF=$(cat) || exit 2
fi
[[ "$BRIEF" =~ [^[:space:]] ]] || { echo 'codex-agent: empty brief' >&2; exit 2; }

WORKER="${CODEX_WORKER:-$HOME/.claude/hooks/ClaudeBrainCodexHands/codex-worker.cjs}"
ROOT_NATIVE="$ROOT"
WORKER_NATIVE="$WORKER"
if command -v cygpath >/dev/null 2>&1; then
  ROOT_NATIVE=$(cygpath -w "$ROOT")
  WORKER_NATIVE=$(cygpath -w "$WORKER")
fi
if [ "$SANDBOX" = read-only ]; then
  SANDBOX_NOTE='Sandbox: read-only - do not try to write files.'
else
  SANDBOX_NOTE='Sandbox: workspace-write - write only the authorized paths.'
fi
PROMPT="You are acting as the \`$AGENT\` agent of the RehabTrainerHub game team (Claude Code Game Studios framework). First read \`.claude/agents/$AGENT.md\` and follow its role, standards and collaboration protocol, then \`AGENTS.md\` (authoritative on any conflict) and \`.claude/docs/codex-workers.md\`.
You run as a non-interactive Codex worker started by the orchestrating Claude session. You cannot ask the user: where your role says to ask, confirm, or ask 'May I write', put the draft and the exact question in your report and stop. You cannot start other agents: name the agent and the question in your report. Write only the paths this brief authorizes.
If the brief names a skill, its files are in \`.claude/skills/<skill>/\`. Return the report format the brief asks for.
$SANDBOX_NOTE

## Task
$BRIEF"

if [ "$DRY_RUN" = yes ]; then
  if [ -f "$WORKER" ]; then WORKER_STATE=exists; else WORKER_STATE=missing; fi
  printf 'worker: %s (%s)\ncwd: %s\nsandbox: %s\nagent file: .claude/agents/%s.md\n' "$WORKER_NATIVE" "$WORKER_STATE" "$ROOT_NATIVE" "$SANDBOX" "$AGENT"
  printf 'command: node "%s" --cwd "%s" --sandbox %s\n\n%s\n' "$WORKER_NATIVE" "$ROOT_NATIVE" "$SANDBOX" "$PROMPT"
  exit 0
fi
[ -f "$WORKER" ] || { echo "codex-agent: worker missing: $WORKER; set CODEX_WORKER to codex-worker.cjs" >&2; exit 2; }

audit() (
  [ -f .claude/hooks/yaml-helper.sh ] || exit 0
  . .claude/hooks/yaml-helper.sh
  session_state_enabled || exit 0
  mkdir -p production/session-logs || exit 0
  printf '%s | codex | %s\n' "$(date +%Y%m%d_%H%M%S)" "$1" >> production/session-logs/agent-audit.log
) 2>/dev/null

audit "Agent invoked: $AGENT (sandbox $SANDBOX)" || true
declare -A BEFORE_STATUS AFTER_STATUS EXISTED_PATHS CHANGED_PATHS
if [ "$SANDBOX" = workspace-write ]; then
  while IFS= read -r -d '' ENTRY; do
    BEFORE_STATUS["${ENTRY:3}"]="$ENTRY"
    case "${ENTRY:0:2}" in *R*|*C*) IFS= read -r -d '' OLD_PATH ;; esac
  done < <(git status --porcelain=v1 -uall -z)
  while IFS= read -r -d '' ENTRY; do
    [ ! -e "$ENTRY" ] || EXISTED_PATHS["$ENTRY"]=yes
  done < <(git ls-files --cached --others --exclude-standard -z)
fi
export CCGS_CODEX_WORKER=1
printf '%s\n' "$PROMPT" | node "$WORKER_NATIVE" --cwd "$ROOT_NATIVE" --sandbox "$SANDBOX"
WORKER_EXIT=${PIPESTATUS[1]}

if [ "$SANDBOX" = workspace-write ]; then
  while IFS= read -r -d '' ENTRY; do
    AFTER_STATUS["${ENTRY:3}"]="$ENTRY"
    case "${ENTRY:0:2}" in *R*|*C*) IFS= read -r -d '' OLD_PATH ;; esac
  done < <(git status --porcelain=v1 -uall -z)
  for CHANGED_PATH in "${!BEFORE_STATUS[@]}" "${!AFTER_STATUS[@]}"; do
    [ "${BEFORE_STATUS[$CHANGED_PATH]:-}" = "${AFTER_STATUS[$CHANGED_PATH]:-}" ] || CHANGED_PATHS["$CHANGED_PATH"]=yes
  done
  for CHANGED_PATH in "${!CHANGED_PATHS[@]}"; do
    while IFS= read -r OBSERVATION; do
      [ -z "$OBSERVATION" ] || printf 'codex-agent: write-guard: %s\n' "$OBSERVATION" >&2
    done < <(bash .claude/scripts/write-guard.sh --root . check "$CHANGED_PATH" --agent "$AGENT" --existed "${EXISTED_PATHS[$CHANGED_PATH]:-no}" 2>&1)
  done
fi
audit "Agent completed: $AGENT (exit $WORKER_EXIT)" || true

ARTIFACT=$(printf '%s\n' "$BRIEF" | awk '
  BEGIN { phrase="Write your full output to `" }
  {
    line=$0
    while ((start=index(line, phrase)) > 0) {
      line=substr(line, start+length(phrase)); end=index(line, "`")
      if (!end) break
      path=substr(line, 1, end-1)
      if (path != "" && path !~ /[\[\]<>{}]/) { print path; exit }
      line=substr(line, end+1)
    }
  }')
if [ -n "$ARTIFACT" ] && bash .claude/scripts/write-guard.sh --root . artifact "$ARTIFACT" | grep -q $'\tmissing$'; then
  echo "codex-agent: Codex worker $AGENT finished, and the file its return contract named is not on disk: $ARTIFACT. Treat that phase as not done (error-recovery protocol, Trigger 0): rerun the worker with the previous result and tell it to write the file." >&2
  [ "$WORKER_EXIT" -ne 0 ] || WORKER_EXIT=4
fi
exit "$WORKER_EXIT"
