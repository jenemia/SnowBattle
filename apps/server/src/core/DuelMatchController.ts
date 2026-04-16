import {
  COUNTDOWN_MS,
  SoloRulesEngine,
  type MatchLifecycle,
  type MatchResultMessage,
  type MatchResultReason,
  type SessionCommand,
  type SessionSnapshot,
  type SlotId
} from "@snowbattle/shared";

interface PlayerState {
  connected: boolean;
  guestName: string;
  ready: boolean;
  sessionId: string;
  slot: SlotId;
}

interface AddPlayerOptions {
  guestName?: string;
  sessionId: string;
}

export class DuelMatchController {
  private countdownEndsAt: number | null = null;
  private engine: SoloRulesEngine | null = null;
  private readonly players = new Map<string, PlayerState>();
  private result: MatchResultMessage | null = null;

  lifecycle: MatchLifecycle = "waiting";

  constructor(public readonly roomId: string) {}

  addPlayer({ guestName, sessionId }: AddPlayerOptions) {
    const slot = this.nextAvailableSlot();

    if (!slot) {
      throw new Error("Room is already full");
    }

    const player: PlayerState = {
      connected: true,
      guestName: guestName?.trim() || `Rider-${slot}`,
      ready: false,
      sessionId,
      slot
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

  receiveCommand(sessionId: string, command: SessionCommand) {
    if (this.lifecycle !== "in_match" || !this.engine) {
      return;
    }

    const player = this.players.get(sessionId);

    if (!player) {
      return;
    }

    this.engine.receiveCommand(player.slot, command);
  }

  removePlayer(
    sessionId: string,
    reason: Extract<MatchResultReason, "forfeit" | "disconnect"> = "forfeit"
  ) {
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
        reason,
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
        this.countdownEndsAt = null;
        this.result = null;
        this.engine = new SoloRulesEngine({
          botEnabled: false,
          guestNames: this.buildGuestNameMap(),
          localSlot: "A"
        });
      }

      return;
    }

    if (this.lifecycle !== "in_match" || !this.engine) {
      return;
    }

    this.engine.tick(deltaMs);

    const result = this.engine.getResult();
    if (!result) {
      return;
    }

    this.finishMatch({
      reason: result.reason,
      winnerSlot: result.winnerSlot
    });
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
    this.engine = null;
    this.result = null;

    for (const player of this.players.values()) {
      player.ready = false;
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

  getPlayers() {
    return [...this.players.values()].sort((left, right) =>
      left.slot.localeCompare(right.slot)
    );
  }

  getSnapshotFor(sessionId: string): SessionSnapshot | null {
    if (!this.engine) {
      return null;
    }

    const player = this.players.get(sessionId);

    if (!player) {
      return null;
    }

    return this.applyPlayerMetadata(this.engine.getSnapshotFor(player.slot));
  }

  getOpponentGuestName(slot: SlotId) {
    return (
      this.getPlayers().find((player) => player.slot !== slot)?.guestName ?? "Waiting..."
    );
  }

  private applyPlayerMetadata(snapshot: SessionSnapshot): SessionSnapshot {
    const localMeta = this.getPlayers().find(
      (player) => player.slot === snapshot.localPlayer.slot
    );
    const opponentMeta = this.getPlayers().find(
      (player) => player.slot === snapshot.opponentPlayer.slot
    );

    return {
      ...snapshot,
      localPlayer: {
        ...snapshot.localPlayer,
        connected: localMeta?.connected ?? false,
        guestName: localMeta?.guestName ?? snapshot.localPlayer.guestName,
        ready: localMeta?.ready ?? false
      },
      opponentPlayer: {
        ...snapshot.opponentPlayer,
        connected: opponentMeta?.connected ?? false,
        guestName: opponentMeta?.guestName ?? snapshot.opponentPlayer.guestName,
        ready: opponentMeta?.ready ?? false
      },
      match: {
        ...snapshot.match,
        countdownRemainingMs: 0,
        lifecycle: this.lifecycle
      },
      hud: {
        ...snapshot.hud,
        result:
          this.result === null
            ? snapshot.hud.result
            : {
                winnerSlot: this.result.winnerSlot,
                reason: this.result.reason
              }
      }
    };
  }

  private buildGuestNameMap(): Record<SlotId, string> {
    return {
      A: this.getPlayers().find((player) => player.slot === "A")?.guestName ?? "Rider-A",
      B: this.getPlayers().find((player) => player.slot === "B")?.guestName ?? "Rider-B"
    };
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
}
