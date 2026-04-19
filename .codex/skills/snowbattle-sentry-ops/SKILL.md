---
name: snowbattle-sentry-ops
description: Use when working on Sentry-backed production debugging in this SnowBattle repo, including how to access Sentry from Codex, how to analyze an issue to root cause, when to mark an issue resolved after a fix, and how to remember each project's Sentry org/project/project-id mapping.
---

# SnowBattle Sentry Ops

이 스킬은 SnowBattle에서 Sentry 이슈를 읽고, 원인을 좁히고, 수정 후 상태를 정리할 때 사용하는 로컬 워크플로우다.

글로벌 Sentry 스킬이 “API를 읽는 방법”을 설명한다면, 이 스킬은 이 프로젝트에서 실제로 어떻게 접근하고 무엇을 기억해야 하는지를 정리한다.

## 언제 쓰는가

- 사용자가 Sentry 이슈 번호를 주고 원인 분석을 요청할 때
- production 에러를 수정하고 재발 여부를 확인할 때
- 수정 후 Sentry 이슈 상태를 `resolved`로 바꿔야 할 때
- 프로젝트별 Sentry org/project/project-id를 다시 찾지 않게 메모 체계를 유지할 때

## 접근 원칙

- 토큰은 채팅에 붙여 넣지 않는다.
- 우선 `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`가 현재 세션에 보이는지 확인한다.
- Codex 실행 세션에 env가 없고 앱 터미널에만 있으면, `read_thread_terminal`로 실제 값을 확인한 뒤 필요한 명령에만 일시 주입한다.
- Sentry API 호출은 읽기 전용 조회에선 글로벌 Sentry 스킬의 `sentry_api.py`를 우선 사용한다.
- 상태 변경(`resolved`)은 GET이 아니라 직접 API `PUT`이 필요하므로, 짧은 Python/HTTP 호출로 처리한다.

## 빠른 접근 순서

### 1. 현재 세션 env 확인

```bash
env | rg '^SENTRY_'
```

필수:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

### 2. 앱 터미널에만 env가 있을 때

- `read_thread_terminal`로 현재 앱 터미널의 `env | rg '^SENTRY_'` 결과를 확인한다.
- 토큰은 로그에 다시 남기지 않도록, 필요한 단일 명령에만 환경변수로 주입한다.

### 3. 이슈 조회

```bash
python3 /Users/sean/.codex/plugins/cache/openai-curated/sentry/b1986b3d3da5bb8a04d3cb1e69af5a29bb5c2c04/skills/sentry/scripts/sentry_api.py \
  --org "$SENTRY_ORG" \
  --project "$SENTRY_PROJECT" \
  list-issues \
  --query "SHORT-ID" \
  --limit 5
```

예:

```bash
... list-issues --query "DELICATE-GLADE-9174-1" --limit 5
```

검색이 비면 최근 `24h` 또는 `14d` 목록을 먼저 읽고 실제 `shortId`와 `id`를 잡는다.

## 분석 절차

### 1. 이슈 메타데이터 확인

먼저 아래를 본다.

- `shortId`
- `title`
- `culprit`
- `url`
- `environment`
- `location`
- `firstSeen`, `lastSeen`

질문:

- 지금 에러가 브라우저 초기 진입에서 나는가?
- 특정 route/path에서만 나는가?
- 릴리즈 직후 시작됐는가?

### 2. 이벤트 상세 확인

이슈 id를 얻었으면:

```bash
python3 ... issue-detail ISSUE_ID
python3 ... issue-events ISSUE_ID --environment production --time-range 24h --limit 5
python3 ... event-detail EVENT_ID
```

확인 포인트:

- `tags.url`
- `transaction`
- `mechanism`
- `contexts.browser`, `contexts.os`
- `metadata.type`, `metadata.value`
- 같은 사용자가 반복 재현했는지

### 3. 로컬 코드와 연결

이슈 문자열 그대로 검색부터 시작한다.

```bash
rg -n "에러문구 일부|TypeError|new URL\\(|함수명" apps packages -S
```

원칙:

- 에러와 맞닿은 API 호출 지점을 먼저 찾는다.
- symptom patch 금지. 실제 입력 경로와 가정이 틀린 곳을 찾는다.
- 브라우저 이슈는 route, base path(`/SnowBattle/`), production env 차이를 먼저 의심한다.

### 4. 근본 원인 판단

다음 중 무엇인지 명확히 적는다.

- 잘못된 입력 데이터
- production path/base URL 차이
- 상대/절대 URL 가정 오류
- 비어 있는 env/config
- race condition
- backend contract drift

수정 전에는 한 문장으로 남긴다.

예:

`portal return helper가 외부 ref를 절대 URL로만 가정해서, GitHub Pages 상대 경로 입력에서 Invalid URL을 발생시킨다.`

### 5. 수정과 회귀 방지

- root cause를 직접 고친다.
- 같은 입력 형태를 재현하는 테스트를 추가한다.
- 최소한 관련 workspace의 테스트 + typecheck를 돌린다.

## Resolved 정책

이 프로젝트에서는 아래 순서를 지킨 뒤에만 이슈를 `resolved`로 바꾼다.

1. 근본 원인 수정 완료
2. 관련 테스트 또는 재현 케이스 추가
3. 로컬 검증 통과
4. 커밋 및 원격 푸시 완료
5. 가능하면 production 배포 또는 배포 예정이 명확함

### `resolved`로 바꾸지 말아야 하는 경우

- 아직 원인 추정만 있고 수정이 없음
- 로컬에서만 막았고 production 반영이 안 됨
- 재현 경로를 이해하지 못한 채 예외만 삼킴
- 같은 패턴의 Sentry 이벤트가 계속 들어오는 중

### 상태 변경 방법

`sentry_api.py`는 읽기 전용이므로, 상태 변경은 직접 API를 호출한다.

```bash
python3 - <<'PY'
import json, urllib.request
issue_id = "ISSUE_ID"
org = "ORG_SLUG"
token = "TOKEN"
url = f"https://sentry.io/api/0/organizations/{org}/issues/{issue_id}/"
body = json.dumps({"status": "resolved"}).encode()
req = urllib.request.Request(
    url,
    data=body,
    method="PUT",
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req) as response:
    print(response.read().decode())
PY
```

그 다음 같은 endpoint를 다시 `GET`해서 최종 상태가 `resolved`인지 확인한다.

주의:

- Sentry가 직후에 다시 `unresolved`로 보일 수 있으므로 한 번 더 조회한다.
- 새 이벤트가 즉시 들어오면 reopen될 수 있다.

## 프로젝트 식별자 기억 규칙

각 프로젝트의 Sentry 식별자는 `TOOLS.md`의 `### Sentry` 섹션에 기록한다.

항상 아래 4개를 같이 적는다.

- org slug
- project slug
- numeric project id
- 최근 확인 날짜

권장 형식:

```markdown
### Sentry

- snowbattle-web
  - org: rlatngus0333navercom
  - project: delicate-glade-9174
  - project_id: 4511232284491776
  - checked_at: 2026-04-19
```

이유:

- 실제 API 조회는 slug를 주로 사용한다.
- 이벤트 payload에는 numeric project id가 자주 보인다.
- 둘 다 남겨야 검색과 대조가 빠르다.

## SnowBattle 기본 습관

- 이슈 번호를 받으면 먼저 `shortId -> issue id`를 확정한다.
- `read_thread_terminal`에 이미 토큰이 보이면 그 값을 재활용하되, 최종 답변에 토큰을 쓰지 않는다.
- 수정한 뒤에는 해당 이슈의 원인과 코드 경로를 한 줄로 요약해 둔다.
- 해결 후에는 `resolved` 처리 여부를 명시적으로 확인하고, 재발 여부는 다음 배포 후 한 번 더 본다.
