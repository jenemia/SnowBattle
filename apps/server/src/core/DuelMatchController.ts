import {
  ARENA_HALF_EXTENT,
  COUNTDOWN_MS,
  FIRE_COOLDOWN_MS,
  MATCH_DURATION_MS,
  PLAYER_SPEED,
  PROJECTILE_SPEED,
  PROJECTILE_TTL_MS
} from "@snowbattle/shared";
import type {
  MatchLifecycle,
  MatchResultMessage,
  MatchResultReason,
  PlayerSnapshot,
  ProjectileSnapshot,
  SlotId
} from "@snowbattle/shared";

interface PlayerInputState {
  sequence: number;
  moveX: number;
  moveY: number;
  pointerAngle: number;
  fire: boolean;
}

interface InternalPlayer extends PlayerSnapshot {
  fireCooldownEndsAt: number;
  input: PlayerInputState;
}

interface InternalProjectile extends ProjectileSnapshot {
  vx: number;
  vy: number;
  expiresAt: number;
}

interface AddPlayerOptions {
  guestName?: string;
  sessionId: string;
}

const DEFAULT_INPUT: PlayerInputState = {
  sequence: 0,
  moveX: 0,
  moveY: 0,
  pointerAngle: 0,
  fire: false
};

const SLOT_SPAWNS: Record<SlotId, { x: number; y: number }> = {
  A: { x: -10, y: 0 },
  B: { x: 10, y: 0 }
};

export class DuelMatchController {
  private readonly players = new Map<string, InternalPlayer>();
  private readonly projectiles = new Map<string, InternalProjectile>();
  private projectileCounter = 0;
  private countdownEndsAt: number | null = null;
  private result: MatchResultMessage | null = null;
  private startedAt: number | null = null;
  private matchEndsAt: number | null = null;

  lifecycle: MatchLifecycle = "waiting";

  constructor(public readonly roomId: string) {}

  addPlayer({ guestName, sessionId }: AddPlayerOptions) {
    const slot = this.nextAvailableSlot();

    if (!slot) {
      throw new Error("Room is already full");
    }

    const spawn = SLOT_SPAWNS[slot];
    const player: InternalPlayer = {
      sessionId,
      slot,
      guestName: guestName?.trim() || `Rider-${slot}`,
      x: spawn.x,
      y: spawn.y,
      angle: slot === "A" ? 0 : Math.PI,
      hp: 1,
      ready: false,
      connected: true,
      fireCooldownEndsAt: 0,
      input: { ...DEFAULT_INPUT }
    };

    this.players.set(sessionId, player);
    this.result = null;

    return player;
  }

  updateGuestName(sessionId: string, guestName?: string) {
    const player = this.players.get(sessionId);

    if (player && guestName?.trim()) {
      player.guestName = guestName.trim();
    }
  }

  setReady(sessionId: string, ready: boolean) {
    const player = this.players.get(sessionId);

    if (player) {
      player.ready = ready;
    }
  }

  receiveInput(
    sessionId: string,
    payload: Extract<
      Parameters<typeof this.handleMessage>[1],
      { type: "player:input"; payload: PlayerInputState }
    >["payload"]
  ) {
    const player = this.players.get(sessionId);

    if (!player) {
      return;
    }

    player.input = payload;
    player.angle = payload.pointerAngle;
  }

  handleMessage(
    sessionId: string,
    message:
      | { type: "player:ready"; payload: { ready: boolean } }
      | { type: "player:input"; payload: PlayerInputState }
  ) {
    if (message.type === "player:ready") {
      this.setReady(sessionId, message.payload.ready);
      return;
    }

    this.receiveInput(sessionId, message.payload);
  }

  removePlayer(sessionId: string) {
    const removed = this.players.get(sessionId);

    if (!removed) {
      return {
        removed: null,
        remainingPlayers: this.players.size,
        result: this.result,
        shouldResetToWaiting: false
      };
    }

    this.players.delete(sessionId);

    if (this.lifecycle === "in_match") {
      const remaining = this.getPlayers()[0] ?? null;
      this.finishMatch({
        reason: "forfeit",
        winnerSlot: remaining?.slot ?? null
      });

      return {
        removed,
        remainingPlayers: this.players.size,
        result: this.result,
        shouldResetToWaiting: false
      };
    }

    const shouldResetToWaiting =
      this.lifecycle === "countdown" || this.lifecycle === "waiting";

    if (shouldResetToWaiting) {
      this.resetToWaiting();
    }

    return {
      removed,
      remainingPlayers: this.players.size,
      result: this.result,
      shouldResetToWaiting
    };
  }

  maybeStartCountdown(now: number) {
    if (
      this.lifecycle === "waiting" &&
      this.players.size === 2 &&
      this.getPlayers().every((player) => player.ready)
    ) {
      this.lifecycle = "countdown";
      this.countdownEndsAt = now + COUNTDOWN_MS;
      this.result = null;
      return true;
    }

    return false;
  }

  tick(deltaMs: number, now: number) {
    if (this.lifecycle === "countdown") {
      if (this.players.size < 2) {
        this.resetToWaiting();
        return;
      }

      if (this.countdownEndsAt && now >= this.countdownEndsAt) {
        this.lifecycle = "in_match";
        this.startedAt = now;
        this.matchEndsAt = now + MATCH_DURATION_MS;
      }

      return;
    }

    if (this.lifecycle !== "in_match") {
      return;
    }

    const deltaSeconds = deltaMs / 1000;

    for (const player of this.players.values()) {
      const magnitude = Math.hypot(player.input.moveX, player.input.moveY) || 1;
      const moveX = player.input.moveX / magnitude;
      const moveY = player.input.moveY / magnitude;

      player.x = clamp(
        player.x + moveX * PLAYER_SPEED * deltaSeconds,
        -ARENA_HALF_EXTENT,
        ARENA_HALF_EXTENT
      );
      player.y = clamp(
        player.y + moveY * PLAYER_SPEED * deltaSeconds,
        -ARENA_HALF_EXTENT,
        ARENA_HALF_EXTENT
      );

      if (player.input.fire && now >= player.fireCooldownEndsAt) {
        player.fireCooldownEndsAt = now + FIRE_COOLDOWN_MS;
        this.spawnProjectile(player, now);
      }

      player.input.fire = false;
    }

    for (const projectile of this.projectiles.values()) {
      projectile.x += projectile.vx * deltaSeconds;
      projectile.y += projectile.vy * deltaSeconds;

      if (
        projectile.expiresAt <= now ||
        Math.abs(projectile.x) > ARENA_HALF_EXTENT + 4 ||
        Math.abs(projectile.y) > ARENA_HALF_EXTENT + 4
      ) {
        this.projectiles.delete(projectile.id);
        continue;
      }

      const target = this.getPlayers().find(
        (player) => player.slot !== projectile.ownerSlot
      );

      if (!target) {
        continue;
      }

      const distance = Math.hypot(projectile.x - target.x, projectile.y - target.y);

      if (distance <= 1.6) {
        this.projectiles.delete(projectile.id);
        this.finishMatch({
          reason: "snowball",
          winnerSlot: projectile.ownerSlot
        });
        return;
      }
    }

    if (this.matchEndsAt && now >= this.matchEndsAt) {
      this.finishMatch({
        reason: "timeout",
        winnerSlot: null
      });
    }
  }

  finishMatch({
    reason,
    winnerSlot
  }: {
    reason: MatchResultReason;
    winnerSlot: SlotId | null;
  }) {
    this.lifecycle = "finished";
    this.countdownEndsAt = null;
    this.matchEndsAt = this.matchEndsAt ?? Date.now();
    this.projectiles.clear();
    this.result = {
      status: "result",
      roomId: this.roomId,
      winnerSlot,
      reason,
      requeueAvailable: true
    };
  }

  resetToWaiting() {
    this.lifecycle = "waiting";
    this.countdownEndsAt = null;
    this.matchEndsAt = null;
    this.startedAt = null;
    this.projectiles.clear();
    this.result = null;

    for (const player of this.players.values()) {
      const spawn = SLOT_SPAWNS[player.slot];
      player.x = spawn.x;
      player.y = spawn.y;
      player.ready = false;
      player.input = { ...DEFAULT_INPUT };
    }
  }

  getCountdownRemaining(now: number) {
    if (this.countdownEndsAt === null) {
      return 0;
    }

    return Math.max(0, this.countdownEndsAt - now);
  }

  getMatchResult() {
    return this.result;
  }

  getPlayers(): PlayerSnapshot[] {
    return [...this.players.values()].sort((left, right) =>
      left.slot.localeCompare(right.slot)
    );
  }

  getProjectiles(): ProjectileSnapshot[] {
    return [...this.projectiles.values()];
  }

  getMatchEndsAt() {
    return this.matchEndsAt;
  }

  getOpponentGuestName(slot: SlotId) {
    return (
      this.getPlayers().find((player) => player.slot !== slot)?.guestName ?? "Waiting..."
    );
  }

  private nextAvailableSlot(): SlotId | null {
    const usedSlots = new Set(this.getPlayers().map((player) => player.slot));

    if (!usedSlots.has("A")) {
      return "A";
    }

    if (!usedSlots.has("B")) {
      return "B";
    }

    return null;
  }

  private spawnProjectile(player: InternalPlayer, now: number) {
    this.projectileCounter += 1;

    const id = `${player.slot}-${this.projectileCounter}`;
    this.projectiles.set(id, {
      id,
      ownerSlot: player.slot,
      x: player.x + Math.cos(player.angle) * 1.2,
      y: player.y + Math.sin(player.angle) * 1.2,
      radius: 0.5,
      vx: Math.cos(player.angle) * PROJECTILE_SPEED,
      vy: Math.sin(player.angle) * PROJECTILE_SPEED,
      expiresAt: now + PROJECTILE_TTL_MS
    });
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
