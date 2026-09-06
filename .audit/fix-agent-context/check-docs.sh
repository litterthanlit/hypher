#!/usr/bin/env bash
# Fail if agent-facing docs still describe unshipped Phase 1a or 1b work.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
fail=0

check_absent() {
	local file="$1"
	local pattern="$2"
	local message="$3"
	if grep -E -q "$pattern" "$root/$file"; then
		printf 'FAIL %s: %s\n' "$file" "$message"
		fail=1
	fi
}

check_present() {
	local file="$1"
	local pattern="$2"
	local message="$3"
	if ! grep -E -q "$pattern" "$root/$file"; then
		printf 'FAIL %s: %s\n' "$file" "$message"
		fail=1
	fi
}

check_absent "docs/PRODUCT.md" 'There are \*\*no `sessionStart`' \
	"still claims session hooks do not exist"
check_absent "AGENTS.md" 'Next coding slice is Phase 1a' \
	"still points agents at shipped Phase 1a"
check_absent "docs/PLAN.md" 'Do \*\*1b\*\* next' \
	"still says Phase 1b is next after hooks shipped"
check_absent "docs/PLAN.md" 'Next coding session: \*\*Phase 1b\*\*' \
	"still sends the next session to rebuild hooks"
check_present "AGENTS.md" 'get_project_context' \
	"does not tell agents to load the Builder Brief once"
check_present "AGENTS.md" 'PRODUCT.md' \
	"must keep PRODUCT.md as the conflict winner"
check_present "docs/PLAN.md" 'Phase 1c' \
	"missing Phase 1c for agents that never get IDE hooks"

if [ "$fail" -ne 0 ]; then
	exit 1
fi

printf 'ok agent-facing docs match shipped loop\n'
