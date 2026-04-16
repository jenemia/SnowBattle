import {
  mountSoloSession,
  presentSoloHud,
  renderSessionHud,
  renderSoloPage
} from "./solo-page";

export function bootSoloPage(root: HTMLDivElement) {
  const ui = renderSoloPage(root);
  let teardown: (() => void) | null = null;

  const remountSession = () => {
    teardown?.();
    teardown = mountSoloSession(ui.viewport, (snapshot) => {
      renderSessionHud(
        {
          actionButton: ui.reset,
          bonfire: ui.bonfire,
          build: ui.build,
          cooldown: ui.cooldown,
          cursor: ui.cursor,
          hp: ui.hp,
          mode: ui.mode,
          opponentHp: ui.opponentHp,
          packedSnow: ui.packedSnow,
          phase: ui.phase,
          position: ui.position,
          preview: ui.preview,
          projectiles: ui.projectiles,
          readout: ui.readout,
          result: ui.result,
          snowLoad: ui.snowLoad,
          status: ui.status,
          structures: ui.structures,
          time: ui.time
        },
        presentSoloHud(snapshot)
      );
    });
  };

  ui.reset.addEventListener("click", () => {
    remountSession();
  });

  remountSession();
}
