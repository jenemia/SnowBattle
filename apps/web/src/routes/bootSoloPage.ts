import { SoloArenaScene } from "../game/SoloArenaScene";
import { SoloInputController } from "../input/SoloInputController";
import { LocalSoloProvider } from "../providers/LocalSoloProvider";

export function bootSoloPage(root: HTMLDivElement) {
  root.innerHTML = `
    <div class="shell shell--solo" data-testid="solo-shell">
      <section class="hero hero--solo">
        <div class="eyebrow">Solo Movement Lab · Low Poly Runner</div>
        <h1 class="title">Snow<span>Stride</span></h1>
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
                <strong id="solo-time" data-testid="solo-time">180.0s</strong>
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
  const time = root.querySelector<HTMLElement>("#solo-time");

  if (
    !viewport ||
    !cooldown ||
    !cursor ||
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
    !time
  ) {
    throw new Error("Missing solo UI nodes");
  }

  let teardown: (() => void) | null = null;

  const mountSession = () => {
    teardown?.();
    viewport.innerHTML = "";

    const scene = new SoloArenaScene(viewport);
    const provider = new LocalSoloProvider();
    const input = new SoloInputController(viewport, scene, provider);
    const unsubscribe = provider.subscribe((snapshot) => {
      scene.render(snapshot);
      cooldown.textContent = `${(snapshot.localPlayer.buildCooldownRemaining / 1000).toFixed(2)}s`;
      cursor.textContent = `${snapshot.hud.cursorX.toFixed(1)} / ${snapshot.hud.cursorZ.toFixed(1)}`;
      build.textContent = snapshot.localPlayer.selectedBuild ?? "combat";
      hp.textContent = `${Math.round(snapshot.localPlayer.hp)}`;
      packedSnow.textContent = `${Math.round(snapshot.localPlayer.packedSnow)}`;
      phase.textContent = snapshot.match.phase;
      preview.textContent = snapshot.hud.buildPreviewValid ? "valid" : "blocked";
      projectiles.textContent = String(snapshot.projectiles.length);
      opponentHp.textContent = `${Math.round(snapshot.opponentPlayer.hp)}`;
      bonfire.textContent = snapshot.match.centerBonfireState;
      snowLoad.textContent = `${Math.round(snapshot.localPlayer.snowLoad)}`;
      status.textContent =
        snapshot.hud.result !== null
          ? "Complete"
          : snapshot.localPlayer.selectedBuild === null
            ? "Combat"
            : "Build";
      mode.textContent =
        snapshot.hud.result !== null
          ? "Round resolved"
          : snapshot.match.phase === "final_push"
            ? "Final push · Builds locked"
            : snapshot.match.phase === "whiteout"
              ? "Whiteout · Stay in the ring"
              : snapshot.localPlayer.selectedBuild === null
                ? snapshot.localPlayer.buildCooldownRemaining > 0
                  ? "Snowball cooling"
                  : "Throw ready"
                : snapshot.hud.buildPreviewValid
                  ? "Placement valid"
                  : "Placement blocked";
      structures.textContent = String(snapshot.structures.length);
      time.textContent = `${(snapshot.match.timeRemainingMs / 1000).toFixed(1)}s`;
      result.textContent = snapshot.hud.result
        ? snapshot.hud.result.winnerSlot === snapshot.localPlayer.slot
          ? `Victory · ${snapshot.hud.result.reason}`
          : snapshot.hud.result.winnerSlot === null
            ? `Draw · ${snapshot.hud.result.reason}`
            : `Defeat · ${snapshot.hud.result.reason}`
        : "";
      reset.disabled = snapshot.hud.result === null;
      readout.textContent = snapshot.hud.result
        ? snapshot.hud.result.winnerSlot === snapshot.localPlayer.slot
          ? "Round complete. Queue another local run whenever you want."
          : snapshot.hud.result.winnerSlot === null
            ? "Round complete. The solo rules engine resolved a draw."
            : "Round complete. Hit restart to iterate on the duel again."
        : snapshot.match.phase === "final_push"
          ? "Final push is active. Builds are locked, so finish the duel in the ring."
          : snapshot.match.phase === "whiteout"
            ? "Whiteout is closing in. Use the ring and bonfire timing to stay alive."
            : snapshot.localPlayer.selectedBuild === null
              ? "Combat mode. Aim with the cursor and click to throw."
              : snapshot.hud.buildPreviewValid
                ? `Build ${snapshot.localPlayer.selectedBuild}. Click to place.`
                : `Build ${snapshot.localPlayer.selectedBuild}. Move to a valid spot.`;
    });

    scene.start();
    provider.connect();
    input.connect();

    teardown = () => {
      unsubscribe();
      input.disconnect();
      provider.disconnect();
      scene.dispose();
    };
  };

  reset.addEventListener("click", () => {
    mountSession();
  });

  mountSession();
}
