import type { SlotId } from "../protocol";
import type { MatchPhase, SessionCommand } from "../session";
import { trySpawnProjectile } from "./projectileStep";
import { trySpawnStructure } from "./structureStep";
import type { SoloRuntimeState } from "./runtimeTypes";

export function reduceCommand(
  runtime: SoloRuntimeState,
  slot: SlotId,
  command: SessionCommand,
  phase: MatchPhase
) {
  const player = runtime.players[slot];

  if (runtime.latestResult !== null) {
    return;
  }

  if (command.type === "input:update") {
    player.moveX = command.payload.moveX;
    player.moveZ = command.payload.moveY;
    player.aimX = command.payload.aimX;
    player.aimZ = command.payload.aimY;
    player.pointerActive = command.payload.pointerActive;
    return;
  }

  if (command.type === "build:select") {
    player.selectedBuild = command.payload.buildType;
    return;
  }

  if (command.type === "build:cancel") {
    player.selectedBuild = null;
    return;
  }

  if (player.selectedBuild !== null) {
    trySpawnStructure(runtime, player, player.selectedBuild, phase);
    return;
  }

  trySpawnProjectile(runtime, player);
}
