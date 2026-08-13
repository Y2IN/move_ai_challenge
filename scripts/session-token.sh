#!/bin/sh
# Claude Code 계정 세션 토큰을 FE/.env.local 로 옮긴다.  사용: npm run session-token
#
# 왜 필요한가
#   콘솔 API 키를 따로 발급받지 않고 **지금 로그인된 Claude 계정 세션**으로
#   LLM 경로(#41 리포트 문단 생성)를 돌리기 위해서다. 팀원마다 키를 발급받고
#   공유하는 과정이 시연 준비에서 제일 자주 새는 구멍이다.
#
# 무엇을 하는가
#   Claude Code 가 보관 중인 OAuth 액세스 토큰을 꺼내
#   FE/.env.local 의 ANTHROPIC_AUTH_TOKEN 줄로 써 넣는다.
#   BE/src/claude.ts 가 이 값을 Authorization: Bearer 로 보낸다.
#
# ⚠️ 토큰은 몇 시간이면 만료된다. 401 이 뜨면 이 스크립트를 다시 돌려라.
# ⚠️ .env.local 은 .gitignore 에 있다. 절대 커밋하지 마라.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT/FE/.env.local"

# macOS 는 키체인, 그 외는 ~/.claude/.credentials.json 에 있다.
RAW=""
if command -v security >/dev/null 2>&1; then
	RAW=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null || true)
fi
if [ -z "$RAW" ] && [ -f "$HOME/.claude/.credentials.json" ]; then
	RAW=$(cat "$HOME/.claude/.credentials.json")
fi

if [ -z "$RAW" ]; then
	cat >&2 <<-'EOF'

		✗ Claude Code 세션 자격증명을 찾지 못했습니다.

		  Claude Code 에 로그인돼 있는지 확인하거나,
		  콘솔 API 키를 쓰려면 FE/.env.local 에 직접 넣으세요:
		    ANTHROPIC_API_KEY=sk-ant-...

	EOF
	exit 1
fi

# 토큰과 만료시각을 한 번에 꺼낸다 (탭 구분).
PARSED=$(printf '%s' "$RAW" | python3 -c '
import json, sys, datetime
d = json.load(sys.stdin)["claudeAiOauth"]
exp = d.get("expiresAt")
left = ""
if exp:
    delta = datetime.datetime.fromtimestamp(exp / 1000) - datetime.datetime.now()
    mins = int(delta.total_seconds() // 60)
    left = f"{mins // 60}시간 {mins % 60}분" if mins > 0 else "만료됨"
print(d["accessToken"], left, sep="\t")
') || {
	echo "✗ 자격증명 파싱에 실패했습니다." >&2
	exit 1
}

TOKEN=$(printf '%s' "$PARSED" | cut -f1)
LEFT=$(printf '%s' "$PARSED" | cut -f2)

if [ -z "$TOKEN" ]; then
	echo "✗ 액세스 토큰이 비어 있습니다." >&2
	exit 1
fi

# 기존 ANTHROPIC_AUTH_TOKEN 줄만 갈아끼운다. 다른 설정(CLAUDE_MODEL 등)은 보존한다.
touch "$ENV_FILE"
TMP=$(mktemp)
grep -v '^ANTHROPIC_AUTH_TOKEN=' "$ENV_FILE" >"$TMP" 2>/dev/null || true
printf 'ANTHROPIC_AUTH_TOKEN=%s\n' "$TOKEN" >>"$TMP"
mv "$TMP" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "✓ FE/.env.local 에 계정 세션 토큰을 넣었습니다 (남은 시간: ${LEFT})."
echo "  dev 서버가 떠 있으면 재시작해야 반영됩니다."
