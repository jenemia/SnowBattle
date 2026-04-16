import { z } from "zod";

export const slotSchema = z.enum(["A", "B"]);
export type SlotId = z.infer<typeof slotSchema>;

export const lifecycleSchema = z.enum([
  "waiting",
  "countdown",
  "in_match",
  "finished"
]);
export type MatchLifecycle = z.infer<typeof lifecycleSchema>;

export const matchResultReasonSchema = z.enum([
  "snowball",
  "forfeit",
  "disconnect",
  "timeout"
]);
export type MatchResultReason = z.infer<typeof matchResultReasonSchema>;

export const clientQueueJoinSchema = z.object({
  guestName: z.string().trim().min(1).max(20).optional()
});

export const clientReadySchema = z.object({
  ready: z.boolean().default(true)
});

export const clientInputSchema = z.object({
  sequence: z.number().int().nonnegative(),
  moveX: z.number().min(-1).max(1),
  moveY: z.number().min(-1).max(1),
  pointerAngle: z.number(),
  fire: z.boolean()
});

export const clientHeartbeatSchema = z.object({
  sentAt: z.number().int().nonnegative()
});

export const clientLeaveSchema = z.object({
  reason: z.string().trim().min(1).max(120).optional()
});

export const clientMessageSchemas = {
  "queue:join": clientQueueJoinSchema,
  "player:ready": clientReadySchema,
  "player:input": clientInputSchema,
  "player:heartbeat": clientHeartbeatSchema,
  "player:leave": clientLeaveSchema
} as const;

export type ClientMessageType = keyof typeof clientMessageSchemas;
export type ClientPayloadMap = {
  [TType in ClientMessageType]: z.infer<(typeof clientMessageSchemas)[TType]>;
};

export interface PlayerSnapshot {
  sessionId: string;
  slot: SlotId;
  guestName: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  ready: boolean;
  connected: boolean;
}

export interface ProjectileSnapshot {
  id: string;
  ownerSlot: SlotId;
  x: number;
  y: number;
  radius: number;
}

export interface QueueStatusMessage {
  status: "queued";
  position: number;
  queuedPlayers: number;
  roomId: string;
}

export interface MatchFoundMessage {
  status: "match_found";
  roomId: string;
  slot: SlotId;
  opponentGuestName: string;
  countdownFrom: number;
}

export interface CountdownMessage {
  status: "countdown";
  roomId: string;
  remainingMs: number;
}

export interface StateSnapshotMessage {
  status: "state";
  roomId: string;
  lifecycle: MatchLifecycle;
  serverTime: number;
  matchEndsAt: number | null;
  players: PlayerSnapshot[];
  projectiles: ProjectileSnapshot[];
}

export interface MatchResultMessage {
  status: "result";
  roomId: string;
  winnerSlot: SlotId | null;
  reason: MatchResultReason;
  requeueAvailable: boolean;
}

export interface RequeuePromptMessage {
  status: "requeue";
  roomId: string;
  available: boolean;
  message: string;
}

export interface PongMessage {
  status: "pong";
  roomId: string;
  receivedAt: number;
}

export type ServerMessage =
  | QueueStatusMessage
  | MatchFoundMessage
  | CountdownMessage
  | StateSnapshotMessage
  | MatchResultMessage
  | RequeuePromptMessage
  | PongMessage;
