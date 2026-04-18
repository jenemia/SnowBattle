import { mountSoloSession, renderSoloPage } from "./solo-page";

export function bootSoloPage(root: HTMLDivElement) {
  const ui = renderSoloPage(root);
  let teardown: (() => void) | null = null;

  const remountSession = () => {
    teardown?.();
    teardown = mountSoloSession(ui.viewport, (snapshot) => {
      ui.reset.disabled = snapshot.hud.result === null;
    });
  };

  ui.reset.addEventListener("click", () => {
    remountSession();
  });

  remountSession();
}
