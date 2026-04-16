import {
  ARENA_HALF_EXTENT,
  MATCH_DURATION_MS,
  PLAYER_SPAWN_OFFSET,
  PROJECTILE_SPAWN_DISTANCE,
  SOLO_BUILD_COOLDOWN_MS,
  SOLO_MAX_PACKED_SNOW,
  SOLO_SNOWBALL_RANGE,
  SOLO_WALL_BLOCK_RADIUS,
  SOLO_WALL_COST
} from "./constants";
import type {
  MatchPhase,
  SessionCommand,
  SessionMatchSnapshot,
  SessionPlayerSnapshot,
  SessionProjectileSnapshot,
  SessionSnapshot,
  SessionStructureSnapshot
} from "./session";
import type { SlotId } from "./protocol";

interface PlayerRuntimeState extends SessionPlayerSnapshot {
  aimX: number;
  aimZ: number;
  moveX: number;
  moveZ: number;
  pointerActive: boolean;
}

interface ProjectileRuntimeState extends SessionProjectileSnapshot {
  traveled: number;
  vx: number;
  vz: number;
}

export interface SoloRulesEngineOptions {
  localSlot?: SlotId;
}

export class SoloRulesEngine {
  private elapsedMs = 0;
  private latestSnapshot: SessionSnapshot;
  private projectileCounter = 0;
  private readonly localSlot: SlotId;
  private readonly players: Record<SlotId, PlayerRuntimeState>;
  private readonly projectiles = new Map<string, ProjectileRuntimeState>();
  private readonly structures = new Map<string, SessionStructureSnapshot>();

  constructor(options: SoloRulesEngineOptions = {}) {
    this.localSlot = options.localSlot ?? "A";
    this.players = {
      A: this.createPlayer("A", 0, PLAYER_SPAWN_OFFSET),
      B: this.createPlayer("B", 0, -PLAYER_SPAWN_OFFSET)
    };
    this.latestSnapshot = this.createSnapshot();
  }

  receiveCommand(slot: SlotId, command: SessionCommand) {
    const player = this.players[slot];

    if (command.type === "input:update") {
      player.moveX = command.payload.moveX;
      player.moveZ = command.payload.moveY;
      player.aimX = command.payload.aimX;
      player.aimZ = command.payload.aimY;
      player.pointerActive = command.payload.pointerActive;
      return;
    }

    if (command.type === "build:select") {
      player.selectedBuild = command.payload.buildType;
      return;
    }

    if (command.type === "build:cancel") {
      player.selectedBuild = null;
      return;
    }

    if (command.type === "action:primary") {
      if (player.selectedBuild === "wall") {
        this.trySpawnWall(player);
        return;
      }

      this.trySpawnProjectile(player);
    }
  }

  tick(deltaMs: number) {
    this.elapsedMs = Math.min(MATCH_DURATION_MS, this.elapsedMs + deltaMs);

    for (const player of Object.values(this.players)) {
      player.buildCooldownRemaining = Math.max(0, player.buildCooldownRemaining - deltaMs);
      player.packedSnow = Math.min(
        SOLO_MAX_PACKED_SNOW,
        player.packedSnow + (deltaMs / 1000) * 5
      );

      const nextX = clamp(player.x + player.moveX * (deltaMs / 1000) * 8, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT);
      const nextZ = clamp(player.z + player.moveZ * (deltaMs / 1000) * 8, -ARENA_HALF_EXTENT, ARENA_HALF_EXTENT);

      player.x = nextX;
      player.z = nextZ;

      const aimX = player.pointerActive ? player.aimX - player.x : 0;
      const aimZ = player.pointerActive ? player.aimZ - player.z : player.slot === "A" ? -1 : 1;

      if (Math.hypot(aimX, aimZ) > 0.001) {
        player.facingAngle = Math.atan2(aimX, aimZ);
      }
    }

    for (const projectile of this.projectiles.values()) {
      const deltaSeconds = deltaMs / 1000;
      projectile.x += projectile.vx * deltaSeconds;
      projectile.z += projectile.vz * deltaSeconds;
      projectile.traveled += Math.hypot(projectile.vx * deltaSeconds, projectile.vz * deltaSeconds);

      if (projectile.traveled >= SOLO_SNOWBALL_RANGE) {
        this.projectiles.delete(projectile.id);
      }
    }

    this.latestSnapshot = this.createSnapshot();
  }

  getSnapshot() {
    return this.latestSnapshot;
  }

  private createPlayer(slot: SlotId, x: number, z: number): PlayerRuntimeState {
    return {
      slot,
      hp: 100,
      snowLoad: 0,
      slowMultiplier: 1,
      packedSnow: SOLO_MAX_PACKED_SNOW,
      selectedBuild: null,
      buildCooldownRemaining: 0,
      x,
      z,
      facingAngle: slot === "A" ? Math.PI : 0,
      aimX: x,
      aimZ: z - 1,
      moveX: 0,
      moveZ: 0,
      pointerActive: false
    };
  }

  private createSnapshot(): SessionSnapshot {
    const localPlayer = this.players[this.localSlot];
    const opponentPlayer = this.players[this.localSlot === "A" ? "B" : "A"];
    const match = this.createMatchSnapshot();

    return {
      localPlayer,
      opponentPlayer,
      structures: [...this.structures.values()],
      projectiles: [...this.projectiles.values()].map((projectile) => ({
        id: projectile.id,
        ownerSlot: projectile.ownerSlot,
        x: projectile.x,
        z: projectile.z,
        expiresAt: projectile.expiresAt
      })),
      match,
      hud: {
        activeBonfire: false,
        buildPreviewValid: this.isBuildPreviewValid(localPlayer),
        cursorX: localPlayer.aimX,
        cursorZ: localPlayer.aimZ,
        pointerActive: localPlayer.pointerActive,
        result: null
      }
    };
  }

  private createMatchSnapshot(): SessionMatchSnapshot {
    const timeRemainingMs = Math.max(0, MATCH_DURATION_MS - this.elapsedMs);
    const phase: MatchPhase = "standard";

    return {
      phase,
      timeRemainingMs,
      whiteoutRadius: ARENA_HALF_EXTENT,
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 }
    };
  }

  private trySpawnProjectile(player: PlayerRuntimeState) {
    const aimX = player.aimX - player.x;
    const aimZ = player.aimZ - player.z;
    const length = Math.hypot(aimX, aimZ);

    if (length < 0.001) {
      return;
    }

    const directionX = aimX / length;
    const directionZ = aimZ / length;

    this.projectileCounter += 1;
    const id = `${player.slot}-${this.projectileCounter}`;
    this.projectiles.set(id, {
      id,
      ownerSlot: player.slot,
      x: player.x + directionX * PROJECTILE_SPAWN_DISTANCE,
      z: player.z + directionZ * PROJECTILE_SPAWN_DISTANCE,
      vx: directionX * 18,
      vz: directionZ * 18,
      traveled: 0,
      expiresAt: this.elapsedMs + 2_200
    });
  }

  private trySpawnWall(player: PlayerRuntimeState) {
    if (player.buildCooldownRemaining > 0 || player.packedSnow < SOLO_WALL_COST) {
      return;
    }

    if (!this.isBuildPreviewValid(player)) {
      return;
    }

    const id = `wall-${player.slot}-${this.structures.size + 1}`;
    this.structures.set(id, {
      id,
      type: "wall",
      ownerSlot: player.slot,
      x: player.aimX,
      z: player.aimZ,
      hp: 120,
      expiresAt: this.elapsedMs + 14_000,
      enabled: true
    });
    player.buildCooldownRemaining = SOLO_BUILD_COOLDOWN_MS;
    player.packedSnow -= SOLO_WALL_COST;
  }

  private isBuildPreviewValid(player: PlayerRuntimeState) {
    if (player.selectedBuild !== "wall") {
      return false;
    }

    if (player.buildCooldownRemaining > 0 || player.packedSnow < SOLO_WALL_COST) {
      return false;
    }

    const distance = Math.hypot(player.aimX - player.x, player.aimZ - player.z);
    if (distance > 7) {
      return false;
    }

    return ![...this.structures.values()].some(
      (structure) =>
        Math.abs(structure.x - player.aimX) < SOLO_WALL_BLOCK_RADIUS &&
        Math.abs(structure.z - player.aimZ) < SOLO_WALL_BLOCK_RADIUS
    );
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
