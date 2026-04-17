# Dual Mode Performance Note

## Scope

- Target: current web duel mode (`apps/web` + `apps/server`)
- Goal: remove frame drops without changing the authoritative `20Hz` match simulation
- Measurement window: 2 seconds during a live duel with two browser clients active

## Before

Initial investigation measured the following per client:

| Metric | Before |
| --- | ---: |
| outgoing websocket sends | 48-49 |
| incoming websocket messages | 58-59 |
| outgoing websocket bytes | 4.5-5.0 KB |
| incoming websocket bytes | 50-51 KB |
| `getBoundingClientRect()` calls | 34-40 |
| RAF callbacks | 94-96 |

## After

Post-fix measurement on the same 2-second duel window:

| Metric | Client A | Client B |
| --- | ---: | ---: |
| outgoing websocket sends | 15 | 18 |
| incoming websocket messages | 58 | 59 |
| outgoing websocket bytes | 1.58 KB | 1.79 KB |
| incoming websocket bytes | 51.35 KB | 51.26 KB |
| `getBoundingClientRect()` calls | 0 | 0 |

## Notes

- Input traffic dropped sharply because duel input now flushes on the server tick budget instead of every animation frame.
- Layout reads dropped to zero during the measured duel window because the camera now uses cached canvas bounds and refreshes them only on resize/scroll/viewport changes.
- Incoming websocket traffic stays roughly flat during live combat by design. The server still sends authoritative in-match state at `20Hz`; the server-side optimization focuses on removing redundant state pushes in `waiting`, `countdown`, and `finished` phases.
