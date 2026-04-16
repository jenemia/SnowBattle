import type { SlotId } from "../protocol.js";
import type { MatchPhase, SessionCommand } from "../session.js";
import { trySpawnProjectile } from "./projectileStep.js";
import { trySpawnStructure } from "./structureStep.js";
import type { SoloRuntimeState } from "./runtimeTypes.js";

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
    const placed = trySpawnStructure(runtime, player, player.selectedBuild, phase);
    if (placed) {
      player.selectedBuild = null;
    }
    return;
  }

  trySpawnProjectile(runtime, player);
}
