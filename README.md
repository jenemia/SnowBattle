# SnowBattle

SnowBattle는 웹에서 바로 들어와 테스트할 수 있는 `io` 스타일 1:1 스노우볼 게임 프로토타입입니다.  
현재 `main` 브랜치는 두 가지 흐름을 포함합니다.

- `/`: Colyseus 기반 듀얼 홈과 멀티플레이 진입 셸
- `/solo`: 백엔드 없이 바로 확인할 수 있는 로컬 전투/빌드 샌드박스

## 현재 개발 스택

### 공통 개발 환경

- 패키지 매니저: `npm`
- 모노레포: `npm workspaces`
- 언어: `TypeScript`
- 포맷팅: `Prettier`
- 린트: `ESLint`

### 프런트엔드

- 번들러 / 개발 서버: `Vite`
- 렌더링: `Three.js`
- 네트워크 클라이언트: `@colyseus/sdk`
- 테스트:
  - 단위 테스트: `Vitest`
  - 브라우저 상호작용 스모크 테스트: `Playwright`

### 백엔드

- 런타임: `Node.js`
- 서버 프레임워크: `Express`
- 실시간 멀티플레이 서버: `Colyseus`
- 전송 계층: `@colyseus/ws-transport`
- 환경 변수 로딩: `dotenv`

### 공유 패키지

- 공통 상수 / 프로토콜 / 검증: `@snowbattle/shared`
- 스키마 검증: `zod`

### 배포

- 프런트 배포: `GitHub Pages`
- 실시간 서버 배포: 별도 Node 호스팅 필요

## 저장소 구조

```text
.
├── apps
│   ├── server   # Colyseus authoritative server
│   └── web      # Vite + Three.js web client
└── packages
    └── shared   # shared constants, protocol, validation
```

## 현재 구현 범위

### 1. 멀티플레이 홈

`/` 경로에서는 jam-ready 듀얼 홈과 멀티플레이 진입 UI를 제공합니다.

- 즉시 접속 가능한 웹 클라이언트
- Colyseus 룸 기반 1:1 매치 흐름
- GitHub Pages에서도 프런트 셸 확인 가능
- 백엔드 URL이 없으면 프리뷰 셸로 동작

### 2. 솔로 샌드박스

`/solo` 경로에서는 로컬 게임플레이 테스트를 바로 해볼 수 있습니다.

- `WASD` / 방향키 이동
- 탑다운 추적 카메라
- 좌클릭 눈덩이 발사
- `1` 키 빌드 모드 진입
- 클릭 위치에 벽 설치
- 벽 파괴 규칙
- 발사체 / 벽 `InstancedMesh + pool` 기반 관리

이 모드는 백엔드 없이도 브라우저에서 바로 동작하므로, 전투감과 조작감을 가장 빠르게 확인할 수 있는 테스트 페이지입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

개발 서버 실행 후 기본 주소:

- 웹 클라이언트: `http://localhost:5173`
- 솔로 샌드박스: `http://localhost:5173/solo`
- 서버 헬스 체크: `http://localhost:2567/health`
- WebSocket 서버: `ws://localhost:2567`

## 주요 스크립트

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run test:browser
npm run test:browser:install
```

설명:

- `npm run dev`: shared watcher + server + web를 동시에 실행
- `npm run build`: shared, server, web 전체 빌드
- `npm run typecheck`: 전체 타입 검사
- `npm run lint`: 전체 ESLint 검사
- `npm run test`: shared/server/web 테스트 실행
- `npm run test:browser`: Playwright 기반 `/solo` 브라우저 스모크 테스트
- `npm run test:browser:install`: Playwright Chromium 설치

## 브라우저 셀프 테스트

현재 `/solo`에 대해 브라우저 자동화 테스트가 연결되어 있습니다.  
다음 시나리오를 자동으로 확인합니다.

- 페이지 렌더링
- `WASD` 이동
- 좌클릭 발사
- `1` 키 빌드 모드 진입
- 커서 이동에 따른 프리뷰 추적
- 클릭 벽 설치

처음 한 번은 아래 명령으로 브라우저를 설치해야 합니다.

```bash
npm run test:browser:install
```

그 다음:

```bash
npm run test:browser
```

## GitHub Pages

이 저장소는 GitHub Pages용 워크플로를 포함하고 있습니다.  
`main` 브랜치 푸시 시 `apps/web/dist`가 배포됩니다.

필수 설정:

1. GitHub 저장소의 `Settings -> Pages`
2. `Build and deployment`
3. `Source`를 `GitHub Actions`로 설정

선택 설정:

- `Settings -> Secrets and variables -> Actions -> Variables`
- `VITE_SERVER_URL` 추가

동작 방식:

- `VITE_SERVER_URL`이 있으면 배포된 웹이 실시간 백엔드에 연결을 시도
- 없으면 GitHub Pages에서 프런트 셸과 `/solo` 테스트 페이지를 확인 가능

## 멀티플레이 서버에 대해

GitHub Pages는 정적 호스팅만 제공하므로, 실제 1:1 매칭 플레이를 하려면 Colyseus 서버를 별도로 띄워야 합니다.

구성 예시:

- 프런트: `https://jenemia.github.io/SnowBattle/`
- 실시간 서버: 별도 Node 호스트 또는 개인 머신의 Colyseus 서버

즉:

- UI와 로컬 샌드박스 확인: GitHub Pages만으로 가능
- 실제 온라인 매칭: 별도 서버 필요

## 환경 변수

대표 환경 변수:

- `VITE_SERVER_URL`: 웹 클라이언트가 연결할 Colyseus 서버 주소

필요 시 `.env` 또는 GitHub Actions Variables에 설정합니다.

## 현재 프로젝트 메모

- 로그인, 저장, 랭크 시스템은 아직 범위 밖입니다.
- 현재 단계의 핵심은 "웹에서 바로 확인 가능한 전투 프로토타입 + Colyseus 멀티플레이 기반"입니다.
- 솔로 샌드박스는 실제 멀티플레이 전투 감각을 빠르게 실험하기 위한 로컬 테스트 환경입니다.
