import type { SlotId } from "../protocol";
import type {
  SessionPlayerSnapshot,
  SessionProjectileSnapshot,
  SessionResultSnapshot,
  SessionStructureSnapshot
} from "../session";

export interface PlayerRuntimeState extends SessionPlayerSnapshot {
  aimX: number;
  aimZ: number;
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
  structures: Map<string, StructureRuntimeState>;
}
