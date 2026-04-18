import type { GameSessionProvider, SessionSnapshot } from "@snowbattle/shared";

import {
  SoloArenaScene,
  type SoloArenaSceneOptions
} from "../../game/SoloArenaScene";
import { SoloInputController } from "../../input/SoloInputController";
import { PredictedDuelRuntime } from "./predictedDuelRuntime";

export interface MountPredictedDuelSessionOptions {
  autoConnect?: boolean;
  onSnapshot: (snapshot: SessionSnapshot) => void;
  provider: GameSessionProvider;
  sceneOptions?: SoloArenaSceneOptions;
  viewport: HTMLElement;
}

export function mountPredictedDuelSession({
  autoConnect = true,
  onSnapshot,
  provider,
  sceneOptions,
  viewport
}: MountPredictedDuelSessionOptions) {
  viewport.innerHTML = "";

  const scene = new SoloArenaScene(viewport, sceneOptions);
  const runtime = new PredictedDuelRuntime(provider);
  const input = new SoloInputController(viewport, scene, provider, (command) => {
    runtime.captureCommand(command);
  });
  const unsubscribeFrame = runtime.subscribe((frame) => {
    scene.render(frame.snapshot);
    onSnapshot(frame.snapshot);
  });
  const unsubscribeState = provider.subscribeStateEnvelope((envelope) => {
    runtime.receiveAuthoritativeState(envelope);
  });

  scene.start();
  input.connect();
  runtime.start();

  if (autoConnect) {
    void provider.connect();
  }

  return () => {
    unsubscribeFrame();
    unsubscribeState();
    runtime.stop();
    input.disconnect();
    void provider.disconnect();
    scene.dispose();
  };
}
