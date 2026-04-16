# SnowBattle

SnowBattle is a jam-ready `io`-style web duel scaffold built for instant browser entry. It pairs players into lightweight 1v1 snowball matches using a Colyseus authoritative server and a Three.js top-down arena client.

## Stack

- `apps/web`: Vite + TypeScript + Three.js
- `apps/server`: Node + TypeScript + Colyseus
- `packages/shared`: shared protocol, constants, and validation

## Quick Start

```bash
npm install
npm run dev
```

Local endpoints:

- Web client: `http://localhost:5173`
- Game server health: `http://localhost:2567/health`
- WebSocket server: `ws://localhost:2567`

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
```

`npm run dev` starts three processes together:

- shared package TypeScript watcher
- Colyseus game server
- Vite web client

## Match Flow

1. Browser client calls `joinOrCreate("duel")`.
2. First player waits in a duel room and sees queue telemetry.
3. Second player joins the same room, both players auto-ready, and the countdown begins.
4. Server simulates movement, projectiles, collisions, timeout, and disconnect forfeits.
5. Finished rounds expose a requeue button that leaves and joins a fresh match.

## Project Notes

- No login or persistence is included in this phase.
- The Vibe Jam integration point is reserved in `apps/web/index.html` via `#vibejam-widget-anchor`.
- Shared message contracts live in `packages/shared/src/protocol.ts`.
- Initial tests cover queue pairing, disconnect behavior, and protocol validation.
