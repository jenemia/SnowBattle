import {
  SERVER_TICK_RATE,
  SoloRulesEngine,
  type MatchRules,
  type AuthoritativeStateEnvelope,
  type GameSessionProvider,
  type SessionMeta,
  type SessionCommand,
  type SessionProviderEvent,
  type SessionSnapshot
} from "@snowbattle/shared";

export interface LocalSoloProviderOptions {
  rules?: Partial<MatchRules>;
}

export class LocalSoloProvider implements GameSessionProvider {
  private animationFrame = 0;
  private connected = false;
  private lastTickAt = 0;
  private lastInputSeq = 0;
  private latestEnvelope: AuthoritativeStateEnvelope | null = null;
  private readonly meta: SessionMeta = {
    guestName: "You",
    localSlot: "A",
    opponentGuestName: "Bot",
    roomId: "local-solo"
  };
  private readonly eventListeners = new Set<(event: SessionProviderEvent) => void>();
  private latestSnapshot: SessionSnapshot | null = null;
  private readonly listeners = new Set<(snapshot: SessionSnapshot) => void>();
  private readonly stateListeners = new Set<
    (state: AuthoritativeStateEnvelope) => void
  >();
  private readonly engine: SoloRulesEngine;

  constructor(options: LocalSoloProviderOptions = {}) {
    this.engine = new SoloRulesEngine({
      guestNames: { A: "You", B: "Bot" },
      rules: options.rules
    });
  }

  connect() {
    if (this.connected) {
      return;
    }

    this.connected = true;
    this.lastTickAt = performance.now();
    this.latestSnapshot = this.engine.getSnapshot();
    this.latestEnvelope = {
      ackInputSeq: this.lastInputSeq,
      roomId: this.meta.roomId,
      serverTick: 0,
      snapshot: this.latestSnapshot
    };
    this.emit();
    this.emitEvent({
      type: "status",
      code: "connected",
      detail: "local solo loop active",
      message: "Local solo provider connected.",
      stage: "connect"
    });
    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  disconnect() {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    window.cancelAnimationFrame(this.animationFrame);
    this.emitEvent({
      type: "status",
      code: "disconnected",
      detail: "local solo loop stopped",
      message: "Local solo provider disconnected.",
      stage: "room_leave"
    });
  }

  send(command: SessionCommand) {
    this.lastInputSeq = Math.max(this.lastInputSeq, command.inputSeq);
    this.engine.receiveCommand("A", command);
  }

  subscribe(listener: (snapshot: SessionSnapshot) => void) {
    this.listeners.add(listener);

    if (this.latestSnapshot) {
      listener(this.latestSnapshot);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeEvent(listener: (event: SessionProviderEvent) => void) {
    this.eventListeners.add(listener);

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  getLatestSnapshot() {
    return this.latestSnapshot;
  }

  subscribeStateEnvelope(listener: (state: AuthoritativeStateEnvelope) => void) {
    this.stateListeners.add(listener);

    if (this.latestEnvelope) {
      listener(this.latestEnvelope);
    }

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  getLatestStateEnvelope() {
    return this.latestEnvelope;
  }

  getSessionMeta() {
    return this.meta;
  }

  private readonly tick = (now: number) => {
    if (!this.connected) {
      return;
    }

    const deltaMs = now - this.lastTickAt;
    const fixedDeltaMs = 1000 / SERVER_TICK_RATE;
    let accumulator = deltaMs;

    while (accumulator >= fixedDeltaMs) {
      this.engine.tick(fixedDeltaMs);
      accumulator -= fixedDeltaMs;
      this.lastTickAt += fixedDeltaMs;
    }

    this.latestSnapshot = this.engine.getSnapshot();
    this.latestEnvelope = {
      ackInputSeq: this.lastInputSeq,
      roomId: this.meta.roomId,
      serverTick: Math.round(this.lastTickAt / (1000 / SERVER_TICK_RATE)),
      snapshot: this.latestSnapshot
    };
    this.emit();
    this.animationFrame = window.requestAnimationFrame(this.tick);
  };

  private emit() {
    if (!this.latestSnapshot) {
      return;
    }

    for (const listener of this.listeners) {
      listener(this.latestSnapshot);
    }

    if (this.latestEnvelope) {
      for (const listener of this.stateListeners) {
        listener(this.latestEnvelope);
      }
    }
  }

  private emitEvent(event: SessionProviderEvent) {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }
}
