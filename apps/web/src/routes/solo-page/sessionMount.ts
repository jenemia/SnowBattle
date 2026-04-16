import type { SessionSnapshot } from "@snowbattle/shared";

import { SoloArenaScene } from "../../game/SoloArenaScene";
import { SoloInputController } from "../../input/SoloInputController";
import { LocalSoloProvider } from "../../providers/LocalSoloProvider";

export function mountSoloSession(
  viewport: HTMLElement,
  onSnapshot: (snapshot: SessionSnapshot) => void
) {
  viewport.innerHTML = "";

  const scene = new SoloArenaScene(viewport);
  const provider = new LocalSoloProvider();
  const input = new SoloInputController(viewport, scene, provider);
  const unsubscribe = provider.subscribe((snapshot) => {
    scene.render(snapshot);
    onSnapshot(snapshot);
  });

  scene.start();
  provider.connect();
  input.connect();

  return () => {
    unsubscribe();
    input.disconnect();
    provider.disconnect();
    scene.dispose();
  };
}
