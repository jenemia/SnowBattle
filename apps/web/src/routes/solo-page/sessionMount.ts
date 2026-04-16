import type { GameSessionProvider, SessionSnapshot } from "@snowbattle/shared";

import { SoloArenaScene } from "../../game/SoloArenaScene";
import { SoloInputController } from "../../input/SoloInputController";
import { LocalSoloProvider } from "../../providers/LocalSoloProvider";

export interface GameSessionMountOptions {
  autoConnect?: boolean;
  onSnapshot: (snapshot: SessionSnapshot) => void;
  provider: GameSessionProvider;
  viewport: HTMLElement;
}

export function mountGameSession({
  autoConnect = true,
  onSnapshot,
  provider,
  viewport
}: GameSessionMountOptions) {
  viewport.innerHTML = "";

  const scene = new SoloArenaScene(viewport);
  const input = new SoloInputController(viewport, scene, provider);
  const unsubscribe = provider.subscribe((snapshot) => {
    scene.render(snapshot);
    onSnapshot(snapshot);
  });

  scene.start();
  input.connect();

  if (autoConnect) {
    void provider.connect();
  }

  return () => {
    unsubscribe();
    input.disconnect();
    void provider.disconnect();
    scene.dispose();
  };
}

export function mountSoloSession(
  viewport: HTMLElement,
  onSnapshot: (snapshot: SessionSnapshot) => void
) {
  return mountGameSession({
    onSnapshot,
    provider: new LocalSoloProvider(),
    viewport
  });
}
