import type { SlotId } from "./protocol";

export type BuildType = "wall" | "snowman_turret" | "heater_beacon";

export type MatchPhase = "standard" | "whiteout" | "final_push" | "finished";

export type CenterBonfireState = "idle" | "active" | "claimed";

export interface InputUpdateCommand {
  type: "input:update";
  payload: {
    aimX: number;
    aimY: number;
    moveX: number;
    moveY: number;
    pointerActive: boolean;
  };
}

export interface ActionPrimaryCommand {
  type: "action:primary";
}

export interface BuildSelectCommand {
  type: "build:select";
  payload: {
    buildType: BuildType;
  };
}

export interface BuildCancelCommand {
  type: "build:cancel";
}

export type SessionCommand =
  | InputUpdateCommand
  | ActionPrimaryCommand
  | BuildSelectCommand
  | BuildCancelCommand;

export interface SessionPlayerSnapshot {
  slot: SlotId;
  hp: number;
  snowLoad: number;
  slowMultiplier: number;
  packedSnow: number;
  selectedBuild: BuildType | null;
  buildCooldownRemaining: number;
  x: number;
  z: number;
  facingAngle: number;
}

export interface SessionStructureSnapshot {
  id: string;
  type: BuildType;
  ownerSlot: SlotId;
  x: number;
  z: number;
  hp: number;
  expiresAt: number;
  enabled: boolean;
}

export interface SessionProjectileSnapshot {
  id: string;
  ownerSlot: SlotId;
  x: number;
  z: number;
  expiresAt: number;
}

export interface SessionResultSnapshot {
  winnerSlot: SlotId | null;
  reason: "elimination" | "timeout";
}

export interface SessionMatchSnapshot {
  phase: MatchPhase;
  timeRemainingMs: number;
  whiteoutRadius: number;
  centerBonfireState: CenterBonfireState;
  centerControlTime: Record<SlotId, number>;
}

export interface SessionHudSnapshot {
  activeBonfire: boolean;
  buildPreviewValid: boolean;
  cursorX: number;
  cursorZ: number;
  pointerActive: boolean;
  result: SessionResultSnapshot | null;
}

export interface SessionSnapshot {
  localPlayer: SessionPlayerSnapshot;
  opponentPlayer: SessionPlayerSnapshot;
  structures: SessionStructureSnapshot[];
  projectiles: SessionProjectileSnapshot[];
  match: SessionMatchSnapshot;
  hud: SessionHudSnapshot;
}

export interface GameSessionProvider {
  connect(): Promise<void> | void;
  disconnect(): Promise<void> | void;
  send(command: SessionCommand): void;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  getLatestSnapshot(): SessionSnapshot | null;
}
