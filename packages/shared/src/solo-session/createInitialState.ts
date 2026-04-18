import { PLAYER_SPAWN_OFFSET, SOLO_MAX_PACKED_SNOW } from "../constants.js";
import { createMatchRules } from "../matchRules.js";
import type { SlotId } from "../protocol.js";
import type { SoloRulesEngineOptions } from "../soloSession.js";
import type { PlayerRuntimeState, SoloRuntimeState } from "./runtimeTypes.js";

function createPlayer(
  slot: SlotId,
  x: number,
  z: number,
  guestName: string
): PlayerRuntimeState {
  return {
    action: "none",
    actionRemainingMs: 0,
    buildCooldownRemaining: 0,
    connected: true,
    facingAngle: slot === "A" ? Math.PI : 0,
    fireCooldownRemaining: 0,
    guestName,
    hp: 100,
    lastHitAt: null,
    moveX: 0,
    moveZ: 0,
    packedSnow: SOLO_MAX_PACKED_SNOW,
    pointerActive: false,
    ready: true,
    selectedBuild: null,
    slowMultiplier: 1,
    slot,
    snowLoad: 0,
    totalDirectDamageDealt: 0,
    x,
    z,
    aimX: x,
    aimZ: z - 1,
    botRepositionTargetX: null,
    botRepositionTargetZ: null
  };
}

export function createInitialState(options: SoloRulesEngineOptions = {}): SoloRuntimeState {
  const botEnabled = options.botEnabled ?? true;
  const guestNames = {
    A: options.guestNames?.A ?? "You",
    B: options.guestNames?.B ?? (botEnabled ? "Bot" : "Opponent")
  };
  const localSlot = options.localSlot ?? "A";
  const rules = createMatchRules(options.rules);

  return {
    botEnabled,
    bonfire: {
      activeUntil: 0,
      activationStart: null,
      captureMs: { A: 0, B: 0 },
      claimedBy: null
    },
    centerControlTime: { A: 0, B: 0 },
    elapsedMs: 0,
    guestNames,
    latestResult: null,
    localSlot,
    players: {
      A: createPlayer("A", 0, PLAYER_SPAWN_OFFSET, guestNames.A),
      B: createPlayer("B", 0, -PLAYER_SPAWN_OFFSET, guestNames.B)
    },
    projectileCounter: 0,
    projectiles: new Map(),
    rules,
    structures: new Map()
  };
}
