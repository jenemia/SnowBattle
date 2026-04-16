import { SoloArena } from "../game/SoloArena";

export function bootSoloPage(root: HTMLDivElement) {
  root.innerHTML = `
    <div class="shell shell--solo">
      <section class="hero hero--solo">
        <div class="eyebrow">Solo Movement Lab · Low Poly Runner</div>
        <h1 class="title">Snow<span>Stride</span></h1>
        <p class="lede">
          A local combat and build sandbox for testing low-poly readability, snowball
          throwing, one-tap wall placement, and a wider tactical camera.
        </p>
        <div class="hero-actions">
          <a class="secondary-link" href="./">Back to duel home</a>
        </div>
      </section>
      <section class="arena">
        <div class="viewport" id="solo-viewport"></div>
        <div class="hud hud--solo">
          <div class="panel panel--solo">
            <h2>Solo Test</h2>
            <div class="status-line">
              <span class="status-pill" id="solo-status">Combat</span>
              <span id="solo-mode">Mode ready</span>
            </div>
            <p class="hint">
              Move with WASD or arrow keys. LMB throws a snowball. Press 1 to preview one
              wall, click to place it, and press Esc to cancel build mode.
            </p>
            <div class="telemetry solo-stats">
              <div>
                <span>Mode</span>
                <strong id="solo-mode-label">combat</strong>
              </div>
              <div>
                <span>Cooldown</span>
                <strong id="solo-cooldown">0.00s</strong>
              </div>
              <div>
                <span>Walls</span>
                <strong id="solo-walls">0</strong>
              </div>
              <div>
                <span>Snowballs</span>
                <strong id="solo-projectiles">0</strong>
              </div>
              <div>
                <span>Speed</span>
                <strong id="solo-speed">0.00</strong>
              </div>
              <div>
                <span>Facing</span>
                <strong id="solo-facing">0°</strong>
              </div>
            </div>
            <div class="solo-readout" id="solo-readout">
              Combat mode. Click to throw a snowball.
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("#solo-viewport");
  const cooldown = root.querySelector<HTMLElement>("#solo-cooldown");
  const speed = root.querySelector<HTMLElement>("#solo-speed");
  const facing = root.querySelector<HTMLElement>("#solo-facing");
  const modeLabel = root.querySelector<HTMLElement>("#solo-mode-label");
  const projectiles = root.querySelector<HTMLElement>("#solo-projectiles");
  const status = root.querySelector<HTMLElement>("#solo-status");
  const mode = root.querySelector<HTMLElement>("#solo-mode");
  const readout = root.querySelector<HTMLElement>("#solo-readout");
  const walls = root.querySelector<HTMLElement>("#solo-walls");

  if (
    !viewport ||
    !cooldown ||
    !speed ||
    !facing ||
    !modeLabel ||
    !projectiles ||
    !status ||
    !mode ||
    !readout ||
    !walls
  ) {
    throw new Error("Missing solo UI nodes");
  }

  const arena = new SoloArena(viewport, (snapshot) => {
    cooldown.textContent = `${(snapshot.cooldownMs / 1000).toFixed(2)}s`;
    speed.textContent = snapshot.speed.toFixed(2);
    facing.textContent = `${Math.round(snapshot.facingDegrees)}°`;
    modeLabel.textContent = snapshot.mode;
    projectiles.textContent = String(snapshot.activeProjectiles);
    status.textContent = snapshot.mode === "build" ? "Build" : "Combat";
    mode.textContent =
      snapshot.mode === "build"
        ? snapshot.buildValid
          ? "Placement valid"
          : "Placement blocked"
        : snapshot.cooldownMs > 0
          ? "Snowball cooling"
          : "Throw ready";
    walls.textContent = String(snapshot.activeWalls);
    readout.textContent =
      snapshot.mode === "build"
        ? snapshot.buildValid
          ? "Build mode. Click to place one wall."
          : "Build mode. Move away from walls, edges, or your player."
        : snapshot.cooldownMs > 0
          ? `Cooldown ${(snapshot.cooldownMs / 1000).toFixed(2)}s · facing ${Math.round(
              snapshot.facingDegrees
            )}°`
          : snapshot.moving
            ? `Input ${snapshot.inputLabel} · stride ${snapshot.stridePhase.toFixed(2)}`
            : "Combat mode. Click to throw a snowball.";
  });

  arena.start();
}
