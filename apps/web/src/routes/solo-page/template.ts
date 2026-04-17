export interface SoloPageElements {
  bonfire: HTMLElement;
  build: HTMLElement;
  cooldown: HTMLElement;
  cursor: HTMLElement;
  hp: HTMLElement;
  mode: HTMLElement;
  opponentHp: HTMLElement;
  packedSnow: HTMLElement;
  phase: HTMLElement;
  position: HTMLElement;
  preview: HTMLElement;
  projectiles: HTMLElement;
  readout: HTMLElement;
  reset: HTMLButtonElement;
  result: HTMLElement;
  root: HTMLDivElement;
  snowLoad: HTMLElement;
  status: HTMLElement;
  structures: HTMLElement;
  timerBadge: HTMLElement;
  time: HTMLElement;
  viewport: HTMLElement;
}

export function renderSoloPage(root: HTMLDivElement): SoloPageElements {
  root.innerHTML = `
    <div class="shell shell--solo" data-testid="solo-shell">
      <section class="hero hero--solo">
        <div class="eyebrow">Solo Movement Lab · Low Poly Runner</div>
        <h1 class="title">Blizzard<span>Brawl</span></h1>
        <p class="lede">
          A local-first duel harness that runs the session rules without a backend so we can
          ship combat, builds, and pacing now and move the same logic server-side later.
        </p>
        <div class="hero-actions">
          <a class="secondary-link" href="./">Back to duel home</a>
          <button class="secondary-link solo-reset" id="solo-reset" type="button" disabled>
            Restart round
          </button>
        </div>
      </section>
      <section class="arena">
        <div class="viewport" id="solo-viewport" data-testid="solo-viewport"></div>
        <div
          class="match-timer-badge"
          id="solo-timer-badge"
          data-testid="solo-timer-badge"
        >
          02:00
        </div>
        <div class="hud hud--solo">
          <div class="panel panel--solo">
            <h2>Solo Test</h2>
            <div class="status-line">
              <span class="status-pill" id="solo-status" data-testid="solo-status">Combat</span>
              <span id="solo-mode" data-testid="solo-mode">Mode ready</span>
            </div>
            <p class="hint">
              Move with WASD or arrow keys. LMB throws. Press 1, 2, 3 to select a build and
              press Esc to cancel. This page now runs through a local session provider.
            </p>
            <div class="telemetry solo-stats">
              <div>
                <span>Phase</span>
                <strong id="solo-phase" data-testid="solo-phase">standard</strong>
              </div>
              <div>
                <span>Time</span>
                <strong id="solo-time" data-testid="solo-time">02:00</strong>
              </div>
              <div>
                <span>HP</span>
                <strong id="solo-hp" data-testid="solo-hp">100</strong>
              </div>
              <div>
                <span>Snow Load</span>
                <strong id="solo-snow-load" data-testid="solo-snow-load">0</strong>
              </div>
              <div>
                <span>Packed Snow</span>
                <strong id="solo-packed-snow" data-testid="solo-packed-snow">100</strong>
              </div>
              <div>
                <span>Build</span>
                <strong id="solo-build" data-testid="solo-build">combat</strong>
              </div>
            </div>
            <div class="solo-debug" data-testid="solo-cursor">0.0 / 0.0</div>
            <div class="solo-debug" data-testid="solo-position">0.0 / 0.0</div>
            <div class="telemetry solo-stats">
              <div>
                <span>Cooldown</span>
                <strong id="solo-cooldown" data-testid="solo-cooldown">0.00s</strong>
              </div>
              <div>
                <span>Structures</span>
                <strong id="solo-structures" data-testid="solo-structures">0</strong>
              </div>
              <div>
                <span>Projectiles</span>
                <strong id="solo-projectiles" data-testid="solo-projectiles">0</strong>
              </div>
              <div>
                <span>Opponent HP</span>
                <strong id="solo-opponent-hp" data-testid="solo-opponent-hp">100</strong>
              </div>
              <div>
                <span>Preview</span>
                <strong id="solo-preview" data-testid="solo-preview">idle</strong>
              </div>
              <div>
                <span>Bonfire</span>
                <strong id="solo-bonfire" data-testid="solo-bonfire">idle</strong>
              </div>
            </div>
            <div class="result" id="solo-result" data-testid="solo-result"></div>
            <div class="solo-readout" id="solo-readout" data-testid="solo-readout">
              Local solo provider connected.
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("#solo-viewport");
  const cooldown = root.querySelector<HTMLElement>("#solo-cooldown");
  const cursor = root.querySelector<HTMLElement>("[data-testid='solo-cursor']");
  const position = root.querySelector<HTMLElement>("[data-testid='solo-position']");
  const build = root.querySelector<HTMLElement>("#solo-build");
  const hp = root.querySelector<HTMLElement>("#solo-hp");
  const packedSnow = root.querySelector<HTMLElement>("#solo-packed-snow");
  const phase = root.querySelector<HTMLElement>("#solo-phase");
  const preview = root.querySelector<HTMLElement>("#solo-preview");
  const projectiles = root.querySelector<HTMLElement>("#solo-projectiles");
  const opponentHp = root.querySelector<HTMLElement>("#solo-opponent-hp");
  const bonfire = root.querySelector<HTMLElement>("#solo-bonfire");
  const reset = root.querySelector<HTMLButtonElement>("#solo-reset");
  const result = root.querySelector<HTMLElement>("#solo-result");
  const snowLoad = root.querySelector<HTMLElement>("#solo-snow-load");
  const status = root.querySelector<HTMLElement>("#solo-status");
  const mode = root.querySelector<HTMLElement>("#solo-mode");
  const readout = root.querySelector<HTMLElement>("#solo-readout");
  const structures = root.querySelector<HTMLElement>("#solo-structures");
  const timerBadge = root.querySelector<HTMLElement>("#solo-timer-badge");
  const time = root.querySelector<HTMLElement>("#solo-time");

  if (
    !viewport ||
    !cooldown ||
    !cursor ||
    !position ||
    !build ||
    !hp ||
    !packedSnow ||
    !phase ||
    !preview ||
    !projectiles ||
    !opponentHp ||
    !bonfire ||
    !reset ||
    !result ||
    !snowLoad ||
    !status ||
    !mode ||
    !readout ||
    !structures ||
    !timerBadge ||
    !time
  ) {
    throw new Error("Missing solo UI nodes");
  }

  return {
    bonfire,
    build,
    cooldown,
    cursor,
    hp,
    mode,
    opponentHp,
    packedSnow,
    phase,
    position,
    preview,
    projectiles,
    readout,
    reset,
    result,
    root,
    snowLoad,
    status,
    structures,
    timerBadge,
    time,
    viewport
  };
}
