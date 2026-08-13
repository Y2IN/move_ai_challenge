#!/bin/sh
# 현재 작업을 브랜치로 올려 PR까지 만든다.  사용: npm run pr [브랜치이름]
#
# main 위에서 실행하면 main에 쌓인 커밋을 새 브랜치로 옮기고
# main은 origin/main 위치로 되돌린다. 이미 브랜치 위라면 그대로 밀어올린다.
set -eu

BASE=main

branch=$(git rev-parse --abbrev-ref HEAD)
git fetch origin "$BASE" --quiet

if [ "$branch" = "$BASE" ]; then
	ahead=$(git rev-list --count "origin/$BASE..HEAD")
	if [ "$ahead" -eq 0 ]; then
		echo "main에 올릴 커밋이 없습니다. 먼저 커밋하세요." >&2
		exit 1
	fi

	name=${1:-}
	if [ -z "$name" ]; then
		printf '브랜치 이름: '
		read -r name
	fi
	[ -n "$name" ] || { echo "브랜치 이름이 필요합니다." >&2; exit 1; }

	git switch -c "$name"
	git branch -f "$BASE" "origin/$BASE"
	echo "→ 커밋 ${ahead}개를 '${name}' 브랜치로 옮겼습니다 (main은 origin/main으로 복귀)."
	branch=$name
fi

git push -u origin "$branch"

if gh pr view --json url >/dev/null 2>&1; then
	echo "→ 이미 열린 PR을 갱신했습니다."
	gh pr view --json url --jq .url
else
	gh pr create --base "$BASE" --fill
fi