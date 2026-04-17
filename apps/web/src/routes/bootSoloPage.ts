import {
  mountSoloSession,
  presentSoloHud,
  renderSessionHud,
  renderSoloPage
} from "./solo-page";

export function bootSoloPage(root: HTMLDivElement) {
  const ui = renderSoloPage(root);
  let lastHud: ReturnType<typeof presentSoloHud> | null = null;
  let teardown: (() => void) | null = null;

  const remountSession = () => {
    teardown?.();
    teardown = mountSoloSession(ui.viewport, (snapshot) => {
      const hud = presentSoloHud(snapshot);

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
          timerBadge: ui.timerBadge,
          time: ui.time
        },
        hud,
        lastHud
      );
      lastHud = hud;
    });
  };

  ui.reset.addEventListener("click", () => {
    lastHud = null;
    remountSession();
  });

  remountSession();
}
