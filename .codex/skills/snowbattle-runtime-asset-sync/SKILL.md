---
name: snowbattle-runtime-asset-sync
description: Use when integrating new assets into this SnowBattle repo and the task touches project-specific runtime paths such as solo-scene renderers, build previews, packages/shared session types, static obstacles, predicted duel runtime, or structure/player animation state.
---

# SnowBattle Runtime Asset Sync

이 스킬은 SnowBattle에서 새 리소스를 “프로젝트 구조에 맞게” 붙일 때 사용하는 로컬 워크플로우다.

글로벌 3D asset 스킬이 일반적인 분석/로더/정규화를 다룬다면, 이 스킬은 이 리포의 실제 연결 지점과 주의사항을 다룬다.

## 언제 쓰는가

- `apps/web/src/resources` 아래 새 pack을 넣었을 때
- `solo-scene` 구조물/캐릭터/환경 리소스를 바꿀 때
- build preview와 실제 설치물이 어긋날 때
- `packages/shared`의 충돌, 배치, line-of-sight, 액션 신호까지 같이 바꿔야 할 때
- `predictedDuelRuntime`까지 포함해 snapshot 필드가 퍼지는 변경일 때

## 주요 파일 맵

- 환경/장애물:
  - `apps/web/src/game/solo-scene/environment.ts`
  - `packages/shared/src/staticObstacles.ts`
- 구조물 렌더/프리뷰:
  - `apps/web/src/game/solo-scene/structureRenderer.ts`
  - `apps/web/src/game/solo-scene/structureVisuals.ts`
  - `apps/web/src/game/solo-scene/overlayRenderer.ts`
- 캐릭터:
  - `apps/web/src/game/solo-scene/blockyCharacterAssets.ts`
  - `apps/web/src/game/solo-scene/playerRenderer.ts`
- shared state:
  - `packages/shared/src/session.ts`
  - `packages/shared/src/solo-session/buildRules.ts`
  - `packages/shared/src/solo-session/playerStep.ts`
  - `packages/shared/src/solo-session/projectileStep.ts`
  - `packages/shared/src/solo-session/structureStep.ts`
- prediction merge:
  - `apps/web/src/routes/solo-page/predictedDuelRuntime.ts`

## 프로젝트 전용 규칙

### 1. preview와 placed object는 같은 시각 config를 공유한다

- SnowBattle에서는 preview mismatch가 자주 문제된다.
- 새 구조물 리소스를 넣을 때는 preview를 procedural primitive로 따로 만들지 말고, 가능한 한 공용 visual config를 통해 맞춘다.
- `assetKey`, `targetHeight`, `targetWidth`, `targetDepth`, `groundClearance`, 회전 기준을 renderer와 preview가 나눠서 들고 있지 않게 한다.

### 2. 시각 변경과 gameplay 변경을 구분한다

- 모델만 커졌는지
- 실제 충돌/배치/시야도 커져야 하는지
- 이 두 개를 항상 분리해서 판단한다.

SnowBattle에서 같이 바꿔야 할 가능성이 큰 곳:
- `packages/shared/src/constants.ts`
- `packages/shared/src/staticObstacles.ts`
- `packages/shared/src/solo-session/geometry.ts`
- `packages/shared/src/solo-session/buildRules.ts`

### 3. 구조물 추적/행동 연출은 snapshot 신호로 연결한다

- 포탑 조준처럼 렌더링만으로는 부족한 연출은 snapshot/runtime 필드가 필요할 수 있다.
- 예:
  - `aimRotationY`
  - `action`
  - `actionRemainingMs`

원칙:
- authoritative 값과 시각 연출이 어긋나지 않게 한다.
- 로컬 prediction이 있는 경로는 `predictedDuelRuntime`까지 확인한다.

### 4. 캐릭터 2차 애니메이션은 locomotion + action override로 본다

- 기본:
  - `idle`
  - `walk`
- 액션:
  - `holding-right-shoot`
  - `interact-right`
  - `die`

SnowBattle에서는 일단 이 구조를 유지한다:
- 반복 locomotion
- 짧은 action override
- 종료 후 `idle`/`walk` 복귀

## 작업 순서

1. 리소스 pack 구조와 GLB 내부 구조 확인
2. 어떤 모델을 어디에 매핑할지 정리
3. 공용 asset/visual config 계층 먼저 구성
4. structure/player/environment renderer에 연결
5. preview sync 필요 시 같은 config를 공유하도록 통합
6. gameplay 영향이 있으면 `packages/shared` 상수/룰/타입 확장
7. snapshot 필드가 늘면 prediction merge 경로 확인
8. 테스트, 타입체크, lint

## 검증 명령

- `npm run test --workspace @snowbattle/shared`
- `npm run test --workspace @snowbattle/web`
- `npm run typecheck --workspace @snowbattle/shared`
- `npm run typecheck --workspace @snowbattle/web`
- 필요 시:
  - `npm run lint --workspace @snowbattle/shared`
  - `npm run lint --workspace @snowbattle/web`

## 자주 놓치는 포인트

- preview가 실제 설치물보다 작거나 큰데, renderer와 preview가 다른 기준을 쓰고 있는 경우
- wall이나 obstacle을 키웠는데 shared 충돌/배치 반경을 안 바꾼 경우
- 포탑 추적이나 액션 애니메이션을 renderer만 바꾸고 snapshot 필드를 안 늘린 경우
- 테스트는 통과하지만 `predictedDuelRuntime` merge 경로에서 새 필드가 빠지는 경우
