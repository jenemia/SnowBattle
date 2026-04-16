import { z } from "zod";
import type { SessionCommand, SessionSnapshot } from "./session";

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
  "elimination",
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

const buildTypeSchema = z.enum(["wall", "snowman_turret", "heater_beacon"]);

export const sessionCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("input:update"),
    payload: z.object({
      aimX: z.number(),
      aimY: z.number(),
      moveX: z.number().min(-1).max(1),
      moveY: z.number().min(-1).max(1),
      pointerActive: z.boolean()
    })
  }),
  z.object({
    type: z.literal("action:primary")
  }),
  z.object({
    type: z.literal("build:select"),
    payload: z.object({
      buildType: buildTypeSchema
    })
  }),
  z.object({
    type: z.literal("build:cancel")
  })
]);

export const clientHeartbeatSchema = z.object({
  sentAt: z.number().int().nonnegative()
});

export const clientLeaveSchema = z.object({
  reason: z.string().trim().min(1).max(120).optional()
});

export const clientMessageSchemas = {
  "queue:join": clientQueueJoinSchema,
  "player:ready": clientReadySchema,
  "session:command": sessionCommandSchema,
  "player:heartbeat": clientHeartbeatSchema,
  "player:leave": clientLeaveSchema
} as const;

export type ClientMessageType = keyof typeof clientMessageSchemas;
export type ClientPayloadMap = {
  [TType in ClientMessageType]: z.infer<(typeof clientMessageSchemas)[TType]>;
};

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
  snapshot: SessionSnapshot;
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

export type SessionCommandMessage = z.infer<typeof sessionCommandSchema>;
export type SharedSessionCommand = Extract<SessionCommand, SessionCommandMessage>;
