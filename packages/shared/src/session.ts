import type { MatchLifecycle, SlotId } from "./protocol.js";

export type BuildType = "wall" | "snowman_turret" | "heater_beacon";

export type MatchPhase = "standard" | "whiteout" | "final_push" | "finished";

export type CenterBonfireState = "idle" | "active" | "claimed";

export type SessionResultReason =
  | "elimination"
  | "timeout"
  | "forfeit"
  | "disconnect";

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
  connected: boolean;
  slot: SlotId;
  guestName: string;
  hp: number;
  snowLoad: number;
  slowMultiplier: number;
  packedSnow: number;
  ready: boolean;
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
  reason: SessionResultReason;
}

export interface SessionMatchSnapshot {
  countdownRemainingMs: number;
  phase: MatchPhase;
  lifecycle: MatchLifecycle;
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

export type SessionStatusCode =
  | "idle"
  | "connecting"
  | "connected"
  | "queued"
  | "match_found"
  | "countdown"
  | "requeue"
  | "disconnected"
  | "error";

export type SessionStatusStage =
  | "connect"
  | "matchmake"
  | "room_join"
  | "room_leave";

export interface SessionStatusEvent {
  type: "status";
  attempt?: number;
  code: SessionStatusCode;
  detail?: string;
  message: string;
  serverUrl?: string;
  stage?: SessionStatusStage;
}

export interface SessionQueueEvent {
  type: "queue";
  position: number;
  queuedPlayers: number;
  roomId: string;
}

export interface SessionMatchFoundEvent {
  type: "match_found";
  countdownFrom: number;
  opponentGuestName: string;
  roomId: string;
  slot: SlotId;
}

export interface SessionCountdownEvent {
  type: "countdown";
  remainingMs: number;
  roomId: string;
}

export interface SessionRequeueEvent {
  type: "requeue";
  available: boolean;
  message: string;
  roomId: string;
}

export type SessionProviderEvent =
  | SessionStatusEvent
  | SessionQueueEvent
  | SessionMatchFoundEvent
  | SessionCountdownEvent
  | SessionRequeueEvent;

export interface GameSessionProvider {
  connect(): Promise<void> | void;
  disconnect(): Promise<void> | void;
  send(command: SessionCommand): void;
  subscribeEvent(listener: (event: SessionProviderEvent) => void): () => void;
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void;
  getLatestSnapshot(): SessionSnapshot | null;
}
