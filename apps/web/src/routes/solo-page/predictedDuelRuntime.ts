import {
  SOLO_MATCH_DURATION_MS,
  createInitialState,
  createSnapshot,
  getCurrentPhase,
  getWhiteoutRadius,
  isMatchExpired,
  reduceCommand,
  resolveTimeout,
  updateBonfire,
  updateBonfireCapture,
  updatePlayers,
  updateProjectiles,
  updateStructures,
  type AuthoritativeStateEnvelope,
  type GameSessionProvider,
  type PresentationFrame,
  type SessionCommand,
  type SessionProjectileSnapshot,
  type SessionSnapshot,
  type SessionStructureSnapshot,
  type SoloRuntimeState,
  type ProjectileRuntimeState,
  type StructureRuntimeState,
  type SlotId
} from "@snowbattle/shared";

const INTERPOLATION_DELAY_MS = 120;
const MAX_BUFFER_WINDOW_MS = 1_000;
const PREDICTION_FIXED_STEP_MS = 1000 / 60;

interface BufferedEnvelope {
  envelope: AuthoritativeStateEnvelope;
  receivedAt: number;
}

export class PredictedDuelRuntime {
  private accumulatorMs = 0;
  private readonly bufferedEnvelopes: BufferedEnvelope[] = [];
  private readonly listeners = new Set<(frame: PresentationFrame) => void>();
  private latestFrame: PresentationFrame | null = null;
  private latestNow = 0;
  private pendingCommands: SessionCommand[] = [];
  private predictedRuntime: SoloRuntimeState | null = null;
  private rafId = 0;
  private running = false;

  constructor(private readonly provider: GameSessionProvider) {}

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.latestNow = performance.now();
    const latestEnvelope = this.provider.getLatestStateEnvelope();

    if (latestEnvelope) {
      this.receiveAuthoritativeState(latestEnvelope);
    }

    this.rafId = window.requestAnimationFrame(this.tick);
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    window.cancelAnimationFrame(this.rafId);
  }

  subscribe(listener: (frame: PresentationFrame) => void) {
    this.listeners.add(listener);

    if (this.latestFrame) {
      listener(this.latestFrame);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  receiveAuthoritativeState(envelope: AuthoritativeStateEnvelope) {
    const receivedAt = performance.now();
    this.bufferedEnvelopes.push({ envelope, receivedAt });
    this.trimBufferedEnvelopes(receivedAt);
    this.pendingCommands = this.pendingCommands.filter(
      (command) => command.inputSeq > envelope.ackInputSeq
    );
    this.predictedRuntime = createRuntimeFromSnapshot(
      envelope.snapshot,
      this.predictedRuntime
    );

    for (const command of this.pendingCommands) {
      applyPredictedCommand(this.predictedRuntime, command);
    }
  }

  captureCommand(command: SessionCommand) {
    this.pendingCommands.push(command);

    if (!this.predictedRuntime) {
      const latestEnvelope = this.provider.getLatestStateEnvelope();

      if (latestEnvelope) {
        this.predictedRuntime = createRuntimeFromSnapshot(
          latestEnvelope.snapshot,
          this.predictedRuntime
        );
      }
    }

    if (this.predictedRuntime) {
      applyPredictedCommand(this.predictedRuntime, command);
    }
  }

  private readonly tick = (now: number) => {
    if (!this.running) {
      return;
    }

    const deltaMs = now - this.latestNow;
    this.latestNow = now;
    this.accumulatorMs += deltaMs;

    while (this.accumulatorMs >= PREDICTION_FIXED_STEP_MS) {
      this.accumulatorMs -= PREDICTION_FIXED_STEP_MS;

      if (this.predictedRuntime) {
        stepPredictedRuntime(this.predictedRuntime, PREDICTION_FIXED_STEP_MS);
      }
    }

    const snapshot = this.buildPresentationSnapshot(now);

    if (snapshot) {
      this.latestFrame = {
        renderedAt: now,
        snapshot
      };

      for (const listener of this.listeners) {
        listener(this.latestFrame);
      }
    }

    this.rafId = window.requestAnimationFrame(this.tick);
  };

  private buildPresentationSnapshot(now: number) {
    const authoritativeSnapshot =
      interpolateAuthoritativeSnapshot(
        this.bufferedEnvelopes,
        now - INTERPOLATION_DELAY_MS
      ) ??
      this.provider.getLatestSnapshot();

    if (!authoritativeSnapshot) {
      return this.predictedRuntime
        ? createSnapshot(this.predictedRuntime, this.predictedRuntime.localSlot)
        : null;
    }

    if (!this.predictedRuntime) {
      return authoritativeSnapshot;
    }

    const predictedSnapshot = createSnapshot(
      this.predictedRuntime,
      this.predictedRuntime.localSlot
    );

    return mergePredictedSnapshot(
      authoritativeSnapshot,
      predictedSnapshot,
      this.provider.getLatestSnapshot() ?? authoritativeSnapshot
    );
  }

  private trimBufferedEnvelopes(now: number) {
    while (
      this.bufferedEnvelopes.length > 2 &&
      now - this.bufferedEnvelopes[0].receivedAt > MAX_BUFFER_WINDOW_MS
    ) {
      this.bufferedEnvelopes.shift();
    }
  }
}

function applyPredictedCommand(runtime: SoloRuntimeState, command: SessionCommand) {
  reduceCommand(runtime, runtime.localSlot, command, getCurrentPhase(runtime));
}

function stepPredictedRuntime(runtime: SoloRuntimeState, deltaMs: number) {
  if (runtime.latestResult !== null) {
    return;
  }

  runtime.elapsedMs = Math.min(SOLO_MATCH_DURATION_MS, runtime.elapsedMs + deltaMs);
  const phase = getCurrentPhase(runtime);
  const whiteoutRadius = getWhiteoutRadius(runtime);
  const localPlayer = runtime.players[runtime.localSlot];
  const opponentSlot = runtime.localSlot === "A" ? "B" : "A";
  const opponentPlayer = runtime.players[opponentSlot];

  updateBonfire(runtime, deltaMs);
  updatePlayers(runtime, deltaMs, phase, whiteoutRadius);
  updateStructures(runtime, phase, whiteoutRadius, deltaMs / 1000);
  updateProjectiles(runtime, deltaMs / 1000);
  updateBonfireCapture(runtime, deltaMs);

  if (localPlayer.hp <= 0 || opponentPlayer.hp <= 0) {
    runtime.latestResult = {
      reason: "elimination",
      winnerSlot: localPlayer.hp > 0 ? localPlayer.slot : opponentPlayer.slot
    };
    return;
  }

  if (isMatchExpired(runtime)) {
    runtime.latestResult = resolveTimeout(runtime, runtime.localSlot);
  }
}

function createRuntimeFromSnapshot(
  snapshot: SessionSnapshot,
  previousRuntime: SoloRuntimeState | null
): SoloRuntimeState {
  const localSlot = snapshot.localPlayer.slot;
  const playersBySlot = buildPlayersBySlot(snapshot);
  const runtime = createInitialState({
    botEnabled: false,
    guestNames: {
      A: playersBySlot.A.guestName,
      B: playersBySlot.B.guestName
    },
    localSlot
  });
  const elapsedMs = SOLO_MATCH_DURATION_MS - snapshot.match.timeRemainingMs;

  runtime.elapsedMs = Math.max(0, Math.min(SOLO_MATCH_DURATION_MS, elapsedMs));
  runtime.centerControlTime = {
    A: snapshot.match.centerControlTime.A,
    B: snapshot.match.centerControlTime.B
  };
  runtime.latestResult = snapshot.hud.result;
  runtime.bonfire.activationStart =
    snapshot.match.centerBonfireState === "idle" ? null : runtime.elapsedMs;
  runtime.bonfire.activeUntil =
    snapshot.match.centerBonfireState === "idle" ? 0 : runtime.elapsedMs + 1_000;
  runtime.bonfire.captureMs = { A: 0, B: 0 };
  runtime.bonfire.claimedBy = null;

  for (const slot of ["A", "B"] as const) {
    const snapshotPlayer = playersBySlot[slot];
    const previousPlayer = previousRuntime?.players[slot];
    const runtimePlayer = runtime.players[slot];

    runtime.players[slot] = {
      ...runtimePlayer,
      ...snapshotPlayer,
      aimX:
        slot === localSlot
          ? snapshot.hud.cursorX
          : previousPlayer?.aimX ?? snapshotPlayer.x,
      aimZ:
        slot === localSlot
          ? snapshot.hud.cursorZ
          : previousPlayer?.aimZ ?? snapshotPlayer.z + (slot === "A" ? -1 : 1),
      fireCooldownRemaining: previousPlayer?.fireCooldownRemaining ?? 0,
      lastHitAt: previousPlayer?.lastHitAt ?? null,
      moveX: 0,
      moveZ: 0,
      pointerActive:
        slot === localSlot
          ? snapshot.hud.pointerActive
          : previousPlayer?.pointerActive ?? false,
      totalDirectDamageDealt: previousPlayer?.totalDirectDamageDealt ?? 0
    };
  }

  runtime.structures = new Map(
    snapshot.structures.map((structure) => {
      const previousStructure = previousRuntime?.structures.get(structure.id);

      return [
        structure.id,
        {
          ...structure,
          nextFireAt:
            previousStructure?.nextFireAt ?? runtime.elapsedMs + 2_500
        } satisfies StructureRuntimeState
      ];
    })
  );

  runtime.projectiles = new Map(
    snapshot.projectiles.map((projectile) => {
      const previousProjectile = previousRuntime?.projectiles.get(projectile.id);

      return [
        projectile.id,
        {
          ...projectile,
          traveled: previousProjectile?.traveled ?? 0,
          vx: previousProjectile?.vx ?? 0,
          vz: previousProjectile?.vz ?? 0
        } satisfies ProjectileRuntimeState
      ];
    })
  );

  runtime.projectileCounter = Math.max(
    snapshot.projectiles.length,
    previousRuntime?.projectileCounter ?? 0
  );

  return runtime;
}

function buildPlayersBySlot(snapshot: SessionSnapshot) {
  const playersBySlot = {
    A: snapshot.localPlayer.slot === "A" ? snapshot.localPlayer : snapshot.opponentPlayer,
    B: snapshot.localPlayer.slot === "B" ? snapshot.localPlayer : snapshot.opponentPlayer
  };

  return playersBySlot;
}

function interpolateAuthoritativeSnapshot(
  bufferedEnvelopes: BufferedEnvelope[],
  targetTime: number
) {
  if (bufferedEnvelopes.length === 0) {
    return null;
  }

  if (bufferedEnvelopes.length === 1) {
    return cloneSnapshot(bufferedEnvelopes[0].envelope.snapshot);
  }

  let previous = bufferedEnvelopes[0];
  let next = bufferedEnvelopes[bufferedEnvelopes.length - 1];

  for (let index = 1; index < bufferedEnvelopes.length; index += 1) {
    const candidate = bufferedEnvelopes[index];

    if (candidate.receivedAt >= targetTime) {
      next = candidate;
      previous = bufferedEnvelopes[index - 1] ?? candidate;
      break;
    }
  }

  if (next.receivedAt <= previous.receivedAt) {
    return cloneSnapshot(next.envelope.snapshot);
  }

  const progress = clamp01(
    (targetTime - previous.receivedAt) / (next.receivedAt - previous.receivedAt)
  );

  return interpolateSnapshot(
    previous.envelope.snapshot,
    next.envelope.snapshot,
    progress
  );
}

function interpolateSnapshot(
  previous: SessionSnapshot,
  next: SessionSnapshot,
  progress: number
) {
  const snapshot = cloneSnapshot(next);

  snapshot.opponentPlayer = {
    ...next.opponentPlayer,
    facingAngle: lerpAngle(
      previous.opponentPlayer.facingAngle,
      next.opponentPlayer.facingAngle,
      progress
    ),
    x: lerp(previous.opponentPlayer.x, next.opponentPlayer.x, progress),
    z: lerp(previous.opponentPlayer.z, next.opponentPlayer.z, progress)
  };

  snapshot.projectiles = interpolateProjectiles(
    previous.projectiles,
    next.projectiles,
    progress
  );

  return snapshot;
}

function interpolateProjectiles(
  previousProjectiles: SessionProjectileSnapshot[],
  nextProjectiles: SessionProjectileSnapshot[],
  progress: number
) {
  const previousById = new Map(
    previousProjectiles.map((projectile) => [projectile.id, projectile])
  );

  return nextProjectiles.map((projectile) => {
    const previous = previousById.get(projectile.id);

    if (!previous) {
      return { ...projectile };
    }

    return {
      ...projectile,
      x: lerp(previous.x, projectile.x, progress),
      z: lerp(previous.z, projectile.z, progress)
    };
  });
}

function mergePredictedSnapshot(
  baseSnapshot: SessionSnapshot,
  predictedSnapshot: SessionSnapshot,
  latestAuthoritative: SessionSnapshot
) {
  const localSlot = predictedSnapshot.localPlayer.slot;
  const snapshot = cloneSnapshot(baseSnapshot);

  snapshot.localPlayer = { ...predictedSnapshot.localPlayer };
  snapshot.hud = {
    ...snapshot.hud,
    activeBonfire: predictedSnapshot.hud.activeBonfire,
    buildPreviewValid: predictedSnapshot.hud.buildPreviewValid,
    cursorX: predictedSnapshot.hud.cursorX,
    cursorZ: predictedSnapshot.hud.cursorZ,
    pointerActive: predictedSnapshot.hud.pointerActive,
    result: latestAuthoritative.hud.result
  };
  snapshot.match = {
    ...snapshot.match,
    centerControlTime: { ...predictedSnapshot.match.centerControlTime },
    timeRemainingMs: predictedSnapshot.match.timeRemainingMs,
    whiteoutRadius: predictedSnapshot.match.whiteoutRadius
  };
  snapshot.projectiles = mergeOwnedProjectiles(
    snapshot.projectiles,
    predictedSnapshot.projectiles,
    localSlot
  );
  snapshot.structures = mergeOwnedStructures(
    snapshot.structures,
    predictedSnapshot.structures,
    localSlot
  );

  return snapshot;
}

function mergeOwnedProjectiles(
  authoritativeProjectiles: SessionProjectileSnapshot[],
  predictedProjectiles: SessionProjectileSnapshot[],
  localSlot: SlotId
) {
  const merged = authoritativeProjectiles.map((projectile) => ({ ...projectile }));
  const authoritativeIds = new Set(merged.map((projectile) => projectile.id));

  for (const projectile of predictedProjectiles) {
    if (projectile.ownerSlot !== localSlot || authoritativeIds.has(projectile.id)) {
      continue;
    }

    merged.push({ ...projectile });
  }

  return merged;
}

function mergeOwnedStructures(
  authoritativeStructures: SessionStructureSnapshot[],
  predictedStructures: SessionStructureSnapshot[],
  localSlot: SlotId
) {
  const merged = authoritativeStructures.map((structure) => ({ ...structure }));
  const authoritativeIds = new Set(merged.map((structure) => structure.id));

  for (const structure of predictedStructures) {
    if (structure.ownerSlot !== localSlot || authoritativeIds.has(structure.id)) {
      continue;
    }

    merged.push({ ...structure });
  }

  return merged;
}

function cloneSnapshot(snapshot: SessionSnapshot): SessionSnapshot {
  return {
    hud: { ...snapshot.hud, result: snapshot.hud.result ? { ...snapshot.hud.result } : null },
    localPlayer: { ...snapshot.localPlayer },
    match: {
      ...snapshot.match,
      centerControlTime: { ...snapshot.match.centerControlTime }
    },
    opponentPlayer: { ...snapshot.opponentPlayer },
    projectiles: snapshot.projectiles.map((projectile) => ({ ...projectile })),
    structures: snapshot.structures.map((structure) => ({ ...structure }))
  };
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function lerpAngle(from: number, to: number, progress: number) {
  const delta = (((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return from + delta * progress;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
