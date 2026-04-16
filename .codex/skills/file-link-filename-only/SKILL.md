---
name: file-link-filename-only
description: Use when responding with local repository files in this project, or when the user asks how files should be referenced. Format each local file reference as a markdown link whose visible label is the filename only and whose target is the absolute path.
---

# File Link Filename Only

이 스킬은 현재 프로젝트에서 로컬 파일을 언급할 때 표시 형식을 고정한다.

## 기본 규칙

- 로컬 파일은 항상 마크다운 링크로 표현한다.
- 링크의 보이는 텍스트는 파일명만 사용한다.
- 링크 대상은 항상 절대 경로를 사용한다.
- 상대 경로를 링크 대상에 쓰지 않는다.
- 파일명을 백틱으로 감싸지 않는다.
- 경로를 plain text로 길게 풀어 쓰지 않는다. 사용자가 명시적으로 요청한 경우만 예외다.

## 형식

정답 예시:

- [README.md](/Users/sean/Documents/SnowBattle/README.md)
- [SoloArena.ts](/Users/sean/Documents/SnowBattle/apps/web/src/game/SoloArena.ts)

피해야 하는 예시:

- `/Users/sean/Documents/SnowBattle/README.md`
- `README.md`
- [apps/web/src/game/SoloArena.ts](/Users/sean/Documents/SnowBattle/apps/web/src/game/SoloArena.ts)

## 예외

- 같은 응답에 같은 파일명이 여러 개 필요하면, 링크 라벨은 가능하면 파일명만 유지하고 구분 정보는 링크 바깥의 짧은 설명으로 덧붙인다.
- 사용자가 plain text 경로를 직접 요청하면 그 요청을 우선한다.
- 외부 웹 URL은 이 스킬의 대상이 아니다.

## 응답 습관

- 파일을 나열할 때도 같은 규칙을 유지한다.
- "파일:" 같은 설명이 필요해도 링크 라벨은 파일명만 둔다.
- 절대 경로 정보는 링크 타깃에만 넣고, 본문은 최대한 짧게 유지한다.
