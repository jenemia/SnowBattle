import type { MatchRules } from "../matchRules.js";
import type { SlotId } from "../protocol.js";
import type {
  SessionPlayerAction,
  SessionPlayerSnapshot,
  SessionProjectileSnapshot,
  SessionResultSnapshot,
  SessionStructureSnapshot
} from "../session.js";

export interface PlayerRuntimeState extends SessionPlayerSnapshot {
  aimX: number;
  aimZ: number;
  botRepositionTargetX?: number | null;
  botRepositionTargetZ?: number | null;
  fireCooldownRemaining: number;
  lastHitAt: number | null;
  moveX: number;
  moveZ: number;
  pointerActive: boolean;
  totalDirectDamageDealt: number;
}

export interface ProjectileRuntimeState extends SessionProjectileSnapshot {
  traveled: number;
  vx: number;
  vz: number;
}

export interface StructureRuntimeState extends SessionStructureSnapshot {
  nextFireAt: number;
}

export function setPlayerAction(
  player: PlayerRuntimeState,
  action: SessionPlayerAction,
  durationMs: number
) {
  player.action = action;
  player.actionRemainingMs = durationMs;
}

export interface BonfireRuntimeState {
  activeUntil: number;
  activationStart: number | null;
  captureMs: Record<SlotId, number>;
  claimedBy: SlotId | null;
}

export interface SoloRuntimeState {
  botEnabled: boolean;
  bonfire: BonfireRuntimeState;
  centerControlTime: Record<SlotId, number>;
  elapsedMs: number;
  guestNames: Record<SlotId, string>;
  latestResult: SessionResultSnapshot | null;
  localSlot: SlotId;
  players: Record<SlotId, PlayerRuntimeState>;
  projectileCounter: number;
  projectiles: Map<string, ProjectileRuntimeState>;
  rules: MatchRules;
  structures: Map<string, StructureRuntimeState>;
}
