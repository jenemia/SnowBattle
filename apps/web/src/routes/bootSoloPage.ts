import { SoloArena } from "../game/SoloArena";

export function bootSoloPage(root: HTMLDivElement) {
  root.innerHTML = `
    <div class="shell shell--solo">
      <section class="hero hero--solo">
        <div class="eyebrow">Solo Movement Lab · Low Poly Runner</div>
        <h1 class="title">Snow<span>Stride</span></h1>
        <p class="lede">
          A local movement sandbox for testing low-poly character readability, smooth
          WASD control, and a gently tilted top-down chase camera.
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
              <span class="status-pill" id="solo-status">Ready</span>
              <span id="solo-mode">Route /solo</span>
            </div>
            <p class="hint">
              Move with WASD or arrow keys. The character uses local simulation only and
              never attempts a backend connection on this page.
            </p>
            <div class="telemetry solo-stats">
              <div>
                <span>Speed</span>
                <strong id="solo-speed">0.00</strong>
              </div>
              <div>
                <span>Position</span>
                <strong id="solo-position">0.0 / 0.0</strong>
              </div>
              <div>
                <span>Facing</span>
                <strong id="solo-facing">0°</strong>
              </div>
            </div>
            <div class="solo-readout" id="solo-readout">
              Waiting for movement input.
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("#solo-viewport");
  const speed = root.querySelector<HTMLElement>("#solo-speed");
  const position = root.querySelector<HTMLElement>("#solo-position");
  const facing = root.querySelector<HTMLElement>("#solo-facing");
  const status = root.querySelector<HTMLElement>("#solo-status");
  const readout = root.querySelector<HTMLElement>("#solo-readout");

  if (!viewport || !speed || !position || !facing || !status || !readout) {
    throw new Error("Missing solo UI nodes");
  }

  const arena = new SoloArena(viewport, (snapshot) => {
    speed.textContent = snapshot.speed.toFixed(2);
    position.textContent = `${snapshot.x.toFixed(1)} / ${snapshot.z.toFixed(1)}`;
    facing.textContent = `${Math.round(snapshot.facingDegrees)}°`;
    status.textContent = snapshot.moving ? "Moving" : "Ready";
    readout.textContent = snapshot.moving
      ? `Input ${snapshot.inputLabel} · stride ${snapshot.stridePhase.toFixed(2)}`
      : "Waiting for movement input.";
  });

  arena.start();
}
