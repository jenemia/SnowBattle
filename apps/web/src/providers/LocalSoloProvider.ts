import {
  SERVER_TICK_RATE,
  SoloRulesEngine,
  type GameSessionProvider,
  type SessionCommand,
  type SessionSnapshot
} from "@snowbattle/shared";

export class LocalSoloProvider implements GameSessionProvider {
  private animationFrame = 0;
  private connected = false;
  private lastTickAt = 0;
  private latestSnapshot: SessionSnapshot | null = null;
  private readonly listeners = new Set<(snapshot: SessionSnapshot) => void>();
  private readonly engine = new SoloRulesEngine();

  connect() {
    if (this.connected) {
      return;
    }

    this.connected = true;
    this.lastTickAt = performance.now();
    this.latestSnapshot = this.engine.getSnapshot();
    this.emit();
    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  disconnect() {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    window.cancelAnimationFrame(this.animationFrame);
  }

  send(command: SessionCommand) {
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

  getLatestSnapshot() {
    return this.latestSnapshot;
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
  }
}
