import {
  COUNTDOWN_MS,
  SoloRulesEngine,
  type InputUpdateCommand,
  type MatchLifecycle,
  type MatchResultMessage,
  type MatchResultReason,
  type SessionCommand,
  type SessionSnapshot,
  type SlotId
} from "@snowbattle/shared";

interface PlayerState {
  ackInputSeq: number;
  connected: boolean;
  guestName: string;
  latestInput: InputUpdateCommand | null;
  latestInputSeq: number;
  pendingActions: Exclude<SessionCommand, InputUpdateCommand>[];
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
  private orderedPlayersCache: PlayerState[] | null = null;
  private readonly players = new Map<string, PlayerState>();
  private result: MatchResultMessage | null = null;
  private readonly snapshotCache = new Map<string, SessionSnapshot>();
  private snapshotCacheVersion = -1;
  private stateVersion = 0;

  lifecycle: MatchLifecycle = "waiting";

  constructor(public readonly roomId: string) {}

  addPlayer({ guestName, sessionId }: AddPlayerOptions) {
    const slot = this.nextAvailableSlot();

    if (!slot) {
      throw new Error("Room is already full");
    }

    const player: PlayerState = {
      ackInputSeq: 0,
      connected: true,
      guestName: guestName?.trim() || `Rider-${slot}`,
      latestInput: null,
      latestInputSeq: -1,
      pendingActions: [],
      ready: false,
      sessionId,
      slot
    };

    this.players.set(sessionId, player);
    this.result = null;
    this.invalidateState({ playersChanged: true });
    return player;
  }

  updateGuestName(sessionId: string, guestName?: string) {
    const player = this.players.get(sessionId);

    if (player && guestName?.trim()) {
      player.guestName = guestName.trim();
      this.invalidateState();
    }
  }

  setReady(sessionId: string, ready: boolean) {
    const player = this.players.get(sessionId);

    if (player && player.ready !== ready) {
      player.ready = ready;
      this.invalidateState();
    }
  }

  receiveCommand(sessionId: string, command: SessionCommand) {
    const player = this.players.get(sessionId);

    if (!player) {
      return;
    }

    if (command.type === "input:update") {
      if (command.inputSeq >= player.latestInputSeq) {
        player.latestInput = command;
        player.latestInputSeq = command.inputSeq;
        this.invalidateState();
      }

      return;
    }

    if (this.lifecycle !== "in_match" || !this.engine) {
      return;
    }

    insertPendingAction(player.pendingActions, command);
    this.invalidateState();
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
    this.invalidateState({ playersChanged: true });

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
      this.invalidateState();
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
        this.invalidateState();
      }

      return;
    }

    if (this.lifecycle !== "in_match" || !this.engine) {
      return;
    }

    for (const player of this.getOrderedPlayers()) {
      if (player.latestInput) {
        this.engine.receiveCommand(player.slot, player.latestInput);
        player.ackInputSeq = Math.max(player.ackInputSeq, player.latestInput.inputSeq);
      }

      while (player.pendingActions.length > 0) {
        const action = player.pendingActions.shift();

        if (!action) {
          break;
        }

        this.engine.receiveCommand(player.slot, action);
        player.ackInputSeq = Math.max(player.ackInputSeq, action.inputSeq);
      }
    }

    this.engine.tick(deltaMs);
    this.invalidateState();

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
    this.invalidateState();
  }

  resetToWaiting() {
    this.lifecycle = "waiting";
    this.countdownEndsAt = null;
    this.engine = null;
    this.result = null;

    for (const player of this.players.values()) {
      player.latestInput = null;
      player.latestInputSeq = -1;
      player.pendingActions.length = 0;
      player.ready = false;
    }

    this.invalidateState();
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
    return [...this.getOrderedPlayers()];
  }

  getSnapshotFor(sessionId: string): SessionSnapshot | null {
    const player = this.players.get(sessionId);

    if (!player || !this.engine) {
      return null;
    }

    this.refreshSnapshotCache();

    return this.snapshotCache.get(sessionId) ?? null;
  }

  getAckInputSeq(sessionId: string) {
    return this.players.get(sessionId)?.ackInputSeq ?? 0;
  }

  getOpponentGuestName(slot: SlotId) {
    return (
      this.getOrderedPlayers().find((player) => player.slot !== slot)?.guestName ?? "Waiting..."
    );
  }

  private applyPlayerMetadata(
    snapshot: SessionSnapshot,
    playersBySlot: Record<SlotId, PlayerState | null>
  ): SessionSnapshot {
    const localMeta = playersBySlot[snapshot.localPlayer.slot];
    const opponentMeta = playersBySlot[snapshot.opponentPlayer.slot];

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
    const playersBySlot = this.getPlayersBySlot();

    return {
      A: playersBySlot.A?.guestName ?? "Rider-A",
      B: playersBySlot.B?.guestName ?? "Rider-B"
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

  private getOrderedPlayers() {
    if (!this.orderedPlayersCache) {
      this.orderedPlayersCache = [...this.players.values()].sort((left, right) =>
        left.slot.localeCompare(right.slot)
      );
    }

    return this.orderedPlayersCache;
  }

  private getPlayersBySlot(): Record<SlotId, PlayerState | null> {
    const playersBySlot: Record<SlotId, PlayerState | null> = {
      A: null,
      B: null
    };

    for (const player of this.getOrderedPlayers()) {
      playersBySlot[player.slot] = player;
    }

    return playersBySlot;
  }

  private invalidateState(options: { playersChanged?: boolean } = {}) {
    this.stateVersion += 1;

    if (options.playersChanged) {
      this.orderedPlayersCache = null;
    }
  }

  private refreshSnapshotCache() {
    if (!this.engine || this.snapshotCacheVersion === this.stateVersion) {
      return;
    }

    const playersBySlot = this.getPlayersBySlot();
    this.snapshotCache.clear();

    for (const player of this.getOrderedPlayers()) {
      const snapshot = this.applyPlayerMetadata(
        this.engine.getSnapshotFor(player.slot),
        playersBySlot
      );

      this.snapshotCache.set(player.sessionId, snapshot);
    }

    this.snapshotCacheVersion = this.stateVersion;
  }
}

function insertPendingAction(
  queue: Exclude<SessionCommand, InputUpdateCommand>[],
  action: Exclude<SessionCommand, InputUpdateCommand>
) {
  const index = queue.findIndex((candidate) => candidate.inputSeq > action.inputSeq);

  if (index === -1) {
    queue.push(action);
    return;
  }

  queue.splice(index, 0, action);
}
