# Vibe Jam 2026 Submission Prep

## Snapshot

- Jam page: [https://vibej.am/2026/](https://vibej.am/2026/)
- Deadline: 2026-05-01 13:37 UTC
- Korea time: 2026-05-01 22:37 KST
- Submission game: `SnowBattle`
- Submission route: `/`
- Support route kept visible in queue UI: `/solo`

## Rule Evidence

### New game created during the jam

Current git history shows the first game-related commit on `2026-04-16`.

```text
86de73b 2026-04-16 feat(game): 웹 대전 기본 환경을 구축한다
```

This is after the jam start threshold of `2026-04-01`.

### AI-written code requirement

Current recorded workflow in this repository already includes AI-assisted implementation for:

- gameplay bootstrap and browser duel shell
- shared rules engine and provider refactors
- matchmaking regression tests
- Fly.io deployment setup
- frontend Sentry setup

Before submission, add the remaining evidence in this section:

- prompt/session links used during development
- any other AI tools used outside this repository workflow
- short summary of which systems each tool helped build

### Accessible on the web with no login

Current intended production shape:

- frontend: GitHub Pages
- backend: `wss://snowbattle.fly.dev`
- login/signup: none
- payment gate: none

### Required Vibe Jam widget

The required script is now included in the production HTML:

```html
<script async src="https://vibej.am/2026/widget.js"></script>
```

Verification target:

- open deployed `/`
- confirm the entrant widget is visible
- confirm the script is present in the deployed page source

### Instant play expectation

Submission intent:

- `/` immediately attempts multiplayer queue and duel connection
- queue panel still exposes a direct `/solo` escape hatch
- no login flow
- no blocking splash screen

## External Assets And Libraries

Runtime stack and third-party pieces currently used:

- Three.js
- Colyseus
- Vite
- Vitest
- Playwright
- Sentry browser SDK
- Kenney Blocky Characters
- Kenney Holiday Kit

Before submission, add license/source links for every shipped external asset pack.

## Submission Copy Draft

### One-line pitch

`SnowBattle` is an instant-play browser snow duel where two players spawn straight into a fast 1v1 fight, with solo mode always available as a fallback practice lane.

### Short description

SnowBattle is a web-first 1v1 snow combat prototype built during Vibe Jam 2026. The main route drops players into a live Colyseus queue immediately, and the same shared rules engine also powers a solo route for instant fallback play. Move, throw snowballs, place structures, survive the whiteout, and win the duel.

### Controls

- Move: `WASD` or arrow keys
- Throw snowball: left click
- Build slots: `1`, `2`, `3`
- Cancel build: `Esc`

### AI usage draft

This game was built with AI as the primary coding tool. AI-assisted sessions were used for gameplay architecture, shared rules engine extraction, provider adapters, matchmaking tests, deployment setup, monitoring integration, and submission-readiness polish.

Update this copy before submission with the exact tool list you want to disclose publicly.

## Final Dry Run Checklist

### Production access

- [ ] Open the production root URL in a private window
- [ ] Confirm the page loads without login or signup
- [ ] Confirm the Vibe Jam widget is visible
- [ ] Confirm there is no blocking loading screen

### Multiplayer path

- [ ] Confirm the page starts queueing immediately
- [ ] Confirm `snowbattle.fly.dev/health` is healthy
- [ ] Confirm WebSocket connection succeeds from the deployed frontend
- [ ] Confirm a 2-player duel starts from two separate browser sessions

### Solo escape hatch

- [ ] Confirm the queue panel shows the `/solo` entry point
- [ ] Confirm the `/solo` link works from the deployed root page
- [ ] Confirm solo is playable even if multiplayer is slow or unavailable

### Stability

- [ ] Confirm no mixed-content errors
- [ ] Confirm no CORS failures
- [ ] Confirm no fatal console errors on load
- [ ] Confirm Sentry receives frontend errors in production

### Submission form readiness

- [ ] Finalize the production URL to submit
- [ ] Paste the one-line pitch
- [ ] Paste the short description
- [ ] Paste the AI usage statement
- [ ] Attach any extra proof or notes you want ready in case of review
