import { presentSoloHud, renderSoloPage, mountSoloSession } from "./solo-page";

export function bootSoloPage(root: HTMLDivElement) {
  const ui = renderSoloPage(root);
  let teardown: (() => void) | null = null;

  const remountSession = () => {
    teardown?.();
    teardown = mountSoloSession(ui.viewport, (snapshot) => {
      const hud = presentSoloHud(snapshot);

      ui.cooldown.textContent = hud.cooldownText;
      ui.cursor.textContent = hud.cursorText;
      ui.build.textContent = hud.buildText;
      ui.hp.textContent = hud.hpText;
      ui.packedSnow.textContent = hud.packedSnowText;
      ui.phase.textContent = hud.phaseText;
      ui.position.textContent = hud.positionText;
      ui.preview.textContent = hud.previewText;
      ui.projectiles.textContent = hud.projectilesText;
      ui.opponentHp.textContent = hud.opponentHpText;
      ui.bonfire.textContent = hud.bonfireText;
      ui.snowLoad.textContent = hud.snowLoadText;
      ui.status.textContent = hud.statusText;
      ui.mode.textContent = hud.modeText;
      ui.structures.textContent = hud.structuresText;
      ui.time.textContent = hud.timeText;
      ui.result.textContent = hud.resultText;
      ui.reset.disabled = hud.resetDisabled;
      ui.readout.textContent = hud.readoutText;
    });
  };

  ui.reset.addEventListener("click", () => {
    remountSession();
  });

  remountSession();
}
