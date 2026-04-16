import { SOLO_MATCH_DURATION_MS } from "./constants.js";
import type { SlotId } from "./protocol.js";
import type { MatchPhase, SessionCommand } from "./session.js";
import {
  createInitialState,
  createSnapshot,
  getCurrentPhase,
  getWhiteoutRadius,
  isMatchExpired,
  reduceCommand,
  resolveTimeout,
  updateBonfire,
  updateBonfireCapture,
  updateBot,
  updatePlayers,
  updateProjectiles,
  updateStructures,
  type SoloRuntimeState
} from "./solo-session/index.js";

export interface SoloRulesEngineOptions {
  botEnabled?: boolean;
  guestNames?: Partial<Record<SlotId, string>>;
  localSlot?: SlotId;
}

export class SoloRulesEngine {
  private readonly runtime: SoloRuntimeState;
  private latestSnapshot;

  constructor(options: SoloRulesEngineOptions = {}) {
    this.runtime = createInitialState(options);
    this.latestSnapshot = createSnapshot(this.runtime);
  }

  receiveCommand(slot: SlotId, command: SessionCommand) {
    const phase = getCurrentPhase(this.runtime) as MatchPhase;
    reduceCommand(this.runtime, slot, command, phase);
  }

  tick(deltaMs: number) {
    if (this.runtime.latestResult !== null) {
      this.latestSnapshot = createSnapshot(this.runtime);
      return;
    }

    this.runtime.elapsedMs = Math.min(SOLO_MATCH_DURATION_MS, this.runtime.elapsedMs + deltaMs);
    const phase = getCurrentPhase(this.runtime);
    const whiteoutRadius = getWhiteoutRadius(this.runtime);
    const localPlayer = this.runtime.players[this.runtime.localSlot];
    const opponentPlayer =
      this.runtime.players[this.runtime.localSlot === "A" ? "B" : "A"];

    updateBonfire(this.runtime, deltaMs);

    if (this.runtime.botEnabled) {
      updateBot(this.runtime, opponentPlayer, localPlayer, phase, whiteoutRadius);
    }

    updatePlayers(this.runtime, deltaMs, phase, whiteoutRadius);
    updateStructures(this.runtime, phase, whiteoutRadius, deltaMs / 1000);
    updateProjectiles(this.runtime, deltaMs / 1000);
    updateBonfireCapture(this.runtime, deltaMs);

    if (localPlayer.hp <= 0 || opponentPlayer.hp <= 0) {
      this.runtime.latestResult = {
        reason: "elimination",
        winnerSlot: localPlayer.hp > 0 ? localPlayer.slot : opponentPlayer.slot
      };
    } else if (isMatchExpired(this.runtime)) {
      this.runtime.latestResult = resolveTimeout(this.runtime, this.runtime.localSlot);
    }

    this.latestSnapshot = createSnapshot(this.runtime);
  }

  getSnapshot() {
    return this.latestSnapshot;
  }

  getSnapshotFor(localSlot: SlotId) {
    return createSnapshot(this.runtime, localSlot);
  }

  getResult() {
    return this.runtime.latestResult;
  }
}
