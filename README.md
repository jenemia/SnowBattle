# SnowBattle

SnowBattle는 웹 브라우저에서 바로 접속해 테스트할 수 있는 `io` 스타일의 1대1 스노우볼 게임 프로토타입입니다.  
현재 `main` 브랜치에는 두 가지 실행 흐름이 들어 있습니다.

- `/`: Colyseus 기반 멀티플레이 홈 화면과 듀얼 진입 셸
- `/solo`: 백엔드 없이 바로 확인할 수 있는 로컬 전투/건설 샌드박스

## 개발 기술 스택

### 공통 개발 환경

- 패키지 관리: `npm`
- 모노레포 구성: `npm workspaces`
- 주 언어: `TypeScript`
- 코드 포맷팅: `Prettier`
- 정적 분석: `ESLint`

### 웹 클라이언트

- 개발 서버 / 번들러: `Vite`
- 3D 렌더링: `Three.js`
- 실시간 통신 클라이언트: `@colyseus/sdk`
- 테스트:
  - 단위 테스트: `Vitest`
  - 브라우저 상호작용 스모크 테스트: `Playwright`

### 서버

- 런타임: `Node.js`
- HTTP 서버: `Express`
- 실시간 멀티플레이 서버: `Colyseus`
- WebSocket 전송 계층: `@colyseus/ws-transport`
- 환경 변수 로딩: `dotenv`

### 공유 패키지

- 공통 상수 / 메시지 프로토콜 / 검증 로직: `@snowbattle/shared`
- 스키마 검증: `zod`

### 배포

- 웹 프런트 배포: `GitHub Pages`
- 실시간 서버 배포: `Fly.io` 또는 별도 Node 실행 환경

## 저장소 구조

```text
.
├── apps
│   ├── server   # Colyseus 권위형 서버
│   └── web      # Vite + Three.js 웹 클라이언트
└── packages
    └── shared   # 공통 상수, 프로토콜, 검증 로직
```

## 현재 구현 범위

### 멀티플레이 홈 화면

`/` 경로에서는 멀티플레이 진입용 홈 화면을 제공합니다.

- 웹에서 즉시 접속 가능한 클라이언트 셸
- Colyseus 룸 기반 1대1 매치 흐름
- GitHub Pages에서도 프런트 화면 확인 가능
- 백엔드 주소가 없으면 프리뷰 셸 모드로 동작

### 솔로 샌드박스

`/solo` 경로에서는 로컬 게임플레이를 바로 테스트할 수 있습니다.

- `WASD`와 방향키 이동
- 탑다운 추적 카메라
- 좌클릭 눈덩이 발사
- `1` 키로 건설 모드 진입
- 클릭 위치에 벽 설치
- 벽 내구도와 파괴 규칙
- 발사체와 벽을 `InstancedMesh + pool` 구조로 관리

이 모드는 백엔드 없이도 바로 동작하므로, 전투 감각과 조작감을 빠르게 확인하기 위한 테스트 환경으로 사용합니다.

## 로컬에서 실행하기

```bash
npm install
npm run dev
```

실행 후 기본 주소:

- 웹 클라이언트: `http://localhost:5173`
- 솔로 샌드박스: `http://localhost:5173/solo`
- 서버 상태 확인: `http://localhost:2567/health`
- WebSocket 서버: `ws://localhost:2567`

로컬 멀티플레이 주소 규칙:

- `VITE_SERVER_URL`이 비어 있으면 `ws://localhost:2567`에 자동 연결
- 다른 로컬 서버를 쓰고 싶으면 `.env.local` 또는 쉘 환경변수로 `VITE_SERVER_URL` 지정

## 자주 쓰는 명령

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run test:browser
npm run test:browser:install
```

각 명령의 역할:

- `npm run dev`: shared watcher, server, web를 동시에 실행
- `npm run build`: shared, server, web 전체 빌드
- `npm run typecheck`: 전체 타입 검사
- `npm run lint`: 전체 ESLint 검사
- `npm run test`: shared, server, web 테스트 실행
- `npm run test:browser`: `/solo` 브라우저 상호작용 테스트 실행
- `npm run test:browser:install`: Playwright용 Chromium 설치

## 브라우저 셀프 테스트

현재 `/solo`에는 브라우저 자동화 테스트가 연결되어 있습니다.  
다음 시나리오를 자동으로 점검합니다.

- 페이지 렌더링
- `WASD` 이동
- 좌클릭 발사
- `1` 키 건설 모드 진입
- 커서 이동에 따른 프리뷰 추적
- 클릭으로 벽 설치

처음 한 번은 브라우저를 설치해야 합니다.

```bash
npm run test:browser:install
```

그 다음 아래 명령으로 테스트를 실행합니다.

```bash
npm run test:browser
```

## GitHub Pages 배포

이 저장소는 GitHub Pages 배포용 워크플로를 포함하고 있습니다.  
`main` 브랜치에 푸시하면 `apps/web/dist`가 배포됩니다.

필수 설정:

1. GitHub 저장소의 `Settings -> Pages`로 이동
2. `Build and deployment` 항목 확인
3. `Source`를 `GitHub Actions`로 설정

선택 설정:

- `Settings -> Secrets and variables -> Actions -> Variables`
- `VITE_SERVER_URL` 변수 추가

동작 방식:

- `VITE_SERVER_URL`이 있으면 그 주소로 배포된 웹이 실시간 백엔드에 연결을 시도
- `VITE_SERVER_URL`이 없으면 워크플로가 기본값 `wss://snowbattle.fly.dev`를 사용
- production 빌드에서 주소가 비어 있으면 웹은 자동 연결 대신 백엔드 미설정 안내 상태로 남음

## 멀티플레이 서버에 대해

GitHub Pages는 정적 파일만 호스팅하므로, 실제 1대1 온라인 매칭을 하려면 Colyseus 서버를 별도로 띄워야 합니다.

예시 구성:

- 프런트엔드: `https://jenemia.github.io/SnowBattle/`
- 실시간 서버: `wss://snowbattle.fly.dev`

정리하면:

- UI와 로컬 샌드박스 확인: GitHub Pages만으로 가능
- 실제 온라인 매칭: 별도 서버 필요

## 환경 변수

대표 환경 변수:

- `VITE_SERVER_URL`: 웹 클라이언트가 연결할 Colyseus 서버 주소
- `VITE_SENTRY_DSN`: 프런트 브라우저 Sentry DSN
- `VITE_SENTRY_ENVIRONMENT`: 프런트 Sentry environment 이름
- `VITE_SENTRY_TRACES_SAMPLE_RATE`: 프런트 Sentry tracing 샘플링 비율

필요에 따라 `.env` 또는 GitHub Actions 변수에 설정합니다.

권장 값:

- 로컬 개발: `VITE_SERVER_URL=ws://localhost:2567`
- GitHub Pages 운영 빌드: `VITE_SERVER_URL=wss://snowbattle.fly.dev`
- 로컬 개발: `VITE_SENTRY_DSN=` 비워두기 또는 테스트 DSN 사용
- GitHub Pages 운영 빌드: `VITE_SENTRY_DSN=<실제 브라우저 DSN>`
- GitHub Pages 운영 빌드: `VITE_SENTRY_ENVIRONMENT=production`
- GitHub Pages 운영 빌드: `VITE_SENTRY_TRACES_SAMPLE_RATE=0.1`
- 서버 CORS: `CLIENT_ORIGIN=https://jenemia.github.io`
  사용자/조직 Pages가 아니라 프로젝트 Pages라면 origin은 경로 없이 `https://jenemia.github.io`만 사용합니다.

프론트 Sentry 연결:

- 웹 클라이언트는 `@sentry/browser`로 초기화됩니다.
- `VITE_SENTRY_DSN`이 없으면 Sentry는 비활성화됩니다.
- 운영 빌드에서는 GitHub Actions variable `VITE_SENTRY_DSN`을 설정해야 실제 이벤트가 전송됩니다.

## Fly.io 백엔드 배포

이 저장소는 루트 기준 `Dockerfile`과 `fly.toml`을 사용해 `apps/server` 백엔드를 Fly.io에 배포할 수 있도록 준비되어 있습니다.

사전 준비:

1. `fly auth login`
2. 앱 이름 `snowbattle` 사용 가능 여부 확인
3. GitHub Pages origin을 CORS에 허용

운영 환경 변수/시크릿:

```bash
fly secrets set CLIENT_ORIGIN=https://jenemia.github.io
```

필요 시 포트도 명시할 수 있지만, 기본값은 이미 `2567`입니다.

```bash
fly secrets set PORT=2567
```

배포 절차:

```bash
fly deploy
```

배포 확인:

```bash
curl https://snowbattle.fly.dev/health
```

정상 응답 후 연결 규칙:

- 프런트엔드: `VITE_SERVER_URL=wss://snowbattle.fly.dev`
- 백엔드 CORS: `CLIENT_ORIGIN=https://jenemia.github.io`

로컬에서 Docker 이미지 검증:

```bash
docker build -t snowbattle-server .
docker run --rm -p 2567:2567 -e PORT=2567 -e CLIENT_ORIGIN=http://localhost:5173 snowbattle-server
```

## 프로젝트 메모

- 로그인, 저장, 랭크 시스템은 아직 범위에 포함되지 않습니다.
- 현재 단계의 핵심은 웹에서 바로 확인 가능한 전투 프로토타입과 Colyseus 기반 멀티플레이 골격입니다.
- `/solo` 샌드박스는 실제 전투 감각과 입력 흐름을 빠르게 실험하기 위한 로컬 테스트 환경입니다.
