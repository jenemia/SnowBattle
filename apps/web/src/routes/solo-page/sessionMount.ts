import type { GameSessionProvider, SessionSnapshot } from "@snowbattle/shared";

import {
  SoloArenaScene,
  type SoloArenaSceneOptions
} from "../../game/SoloArenaScene";
import { SoloInputController } from "../../input/SoloInputController";
import { LocalSoloProvider } from "../../providers/LocalSoloProvider";

export interface GameSessionMountOptions {
  autoConnect?: boolean;
  onSceneError?: (error: unknown) => void;
  onSnapshot: (snapshot: SessionSnapshot) => void;
  provider: GameSessionProvider;
  sceneOptions?: SoloArenaSceneOptions;
  viewport: HTMLElement;
}

export function mountGameSession({
  autoConnect = true,
  onSceneError,
  onSnapshot,
  provider,
  sceneOptions,
  viewport
}: GameSessionMountOptions) {
  viewport.innerHTML = "";

  let scene: SoloArenaScene;

  try {
    scene = new SoloArenaScene(viewport, sceneOptions);
  } catch (error) {
    onSceneError?.(error);
    return () => {
      void provider.disconnect();
    };
  }

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
  onSnapshot: (snapshot: SessionSnapshot) => void,
  onSceneError?: (error: unknown) => void
) {
  return mountGameSession({
    onSceneError,
    onSnapshot,
    provider: new LocalSoloProvider(),
    sceneOptions: {
      portals: {
        showExitPortal: true,
        showReturnPortal: false
      }
    },
    viewport
  });
}
