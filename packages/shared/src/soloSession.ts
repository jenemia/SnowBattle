import {
  ARENA_HALF_EXTENT,
  FIRE_COOLDOWN_MS,
  MATCH_DURATION_MS,
  PLAYER_SPEED,
  PLAYER_SPAWN_OFFSET,
  PROJECTILE_SPEED,
  PROJECTILE_TTL_MS,
  PROJECTILE_SPAWN_DISTANCE,
  SOLO_BUILD_COOLDOWN_MS,
  SOLO_MAX_PACKED_SNOW,
  SOLO_MAX_SLOW_PENALTY,
  SOLO_PACKED_SNOW_ON_DIRECT_HIT,
  SOLO_PACKED_SNOW_REGEN_PER_SECOND,
  SOLO_SNOWBALL_DAMAGE,
  SOLO_SNOWBALL_LOAD,
  SOLO_SNOWBALL_RANGE,
  SOLO_SNOW_LOAD_MELT_DELAY_MS,
  SOLO_SNOW_LOAD_MELT_PER_SECOND,
  SOLO_SNOW_LOAD_SLOW_PER_20,
  SOLO_WALL_BLOCK_RADIUS,
  SOLO_WALL_COST,
  SOLO_WALL_DURATION_MS,
  SOLO_WALL_HP
} from "./constants";
import type {
  MatchPhase,
  SessionCommand,
  SessionMatchSnapshot,
  SessionPlayerSnapshot,
  SessionProjectileSnapshot,
  SessionResultSnapshot,
  SessionSnapshot,
  SessionStructureSnapshot
} from "./session";
import type { SlotId } from "./protocol";

interface PlayerRuntimeState extends SessionPlayerSnapshot {
  aimX: number;
  aimZ: number;
  fireCooldownRemaining: number;
  lastHitAt: number | null;
  moveX: number;
  moveZ: number;
  pointerActive: boolean;
  totalDirectDamageDealt: number;
}

interface ProjectileRuntimeState extends SessionProjectileSnapshot {
  traveled: number;
  vx: number;
  vz: number;
}

export interface SoloRulesEngineOptions {
  botEnabled?: boolean;
  localSlot?: SlotId;
}

export class SoloRulesEngine {
  private readonly botEnabled: boolean;
  private elapsedMs = 0;
  private latestResult: SessionResultSnapshot | null = null;
  private latestSnapshot: SessionSnapshot;
  private projectileCounter = 0;
  private readonly localSlot: SlotId;
  private readonly players: Record<SlotId, PlayerRuntimeState>;
  private readonly projectiles = new Map<string, ProjectileRuntimeState>();
  private readonly structures = new Map<string, SessionStructureSnapshot>();

  constructor(options: SoloRulesEngineOptions = {}) {
    this.botEnabled = options.botEnabled ?? true;
    this.localSlot = options.localSlot ?? "A";
    this.players = {
      A: this.createPlayer("A", 0, PLAYER_SPAWN_OFFSET),
      B: this.createPlayer("B", 0, -PLAYER_SPAWN_OFFSET)
    };
    this.latestSnapshot = this.createSnapshot();
  }

  receiveCommand(slot: SlotId, command: SessionCommand) {
    const player = this.players[slot];

    if (this.latestResult !== null) {
      return;
    }

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
    if (this.latestResult !== null) {
      this.latestSnapshot = this.createSnapshot();
      return;
    }

    this.elapsedMs = Math.min(MATCH_DURATION_MS, this.elapsedMs + deltaMs);
    const localPlayer = this.players[this.localSlot];
    const opponentPlayer = this.players[this.localSlot === "A" ? "B" : "A"];
    const deltaSeconds = deltaMs / 1000;

    if (this.botEnabled) {
      this.updateBot(opponentPlayer, localPlayer);
    }

    for (const player of Object.values(this.players)) {
      player.buildCooldownRemaining = Math.max(0, player.buildCooldownRemaining - deltaMs);
      player.fireCooldownRemaining = Math.max(0, player.fireCooldownRemaining - deltaMs);
      player.packedSnow = Math.min(
        SOLO_MAX_PACKED_SNOW,
        player.packedSnow + deltaSeconds * SOLO_PACKED_SNOW_REGEN_PER_SECOND
      );

      if (
        player.lastHitAt !== null &&
        this.elapsedMs - player.lastHitAt >= SOLO_SNOW_LOAD_MELT_DELAY_MS
      ) {
        player.snowLoad = Math.max(
          0,
          player.snowLoad - deltaSeconds * SOLO_SNOW_LOAD_MELT_PER_SECOND
        );
      }

      player.slowMultiplier = 1 - getSlowPenalty(player.snowLoad);

      const moveSpeed = PLAYER_SPEED * player.slowMultiplier;
      player.x = clamp(
        player.x + player.moveX * deltaSeconds * moveSpeed,
        -ARENA_HALF_EXTENT,
        ARENA_HALF_EXTENT
      );
      player.z = clamp(
        player.z + player.moveZ * deltaSeconds * moveSpeed,
        -ARENA_HALF_EXTENT,
        ARENA_HALF_EXTENT
      );

      const aimX = player.pointerActive ? player.aimX - player.x : 0;
      const aimZ = player.pointerActive
        ? player.aimZ - player.z
        : player.slot === "A"
          ? -1
          : 1;

      if (Math.hypot(aimX, aimZ) > 0.001) {
        player.facingAngle = Math.atan2(aimX, aimZ);
      }
    }

    for (const projectile of this.projectiles.values()) {
      projectile.x += projectile.vx * deltaSeconds;
      projectile.z += projectile.vz * deltaSeconds;
      projectile.traveled += Math.hypot(
        projectile.vx * deltaSeconds,
        projectile.vz * deltaSeconds
      );

      if (
        projectile.traveled >= SOLO_SNOWBALL_RANGE ||
        projectile.expiresAt <= this.elapsedMs
      ) {
        this.projectiles.delete(projectile.id);
        continue;
      }

      const target = this.players[projectile.ownerSlot === "A" ? "B" : "A"];
      const hitDistance = Math.hypot(projectile.x - target.x, projectile.z - target.z);

      if (hitDistance <= 1.2) {
        this.applyDirectHit(this.players[projectile.ownerSlot], target);
        this.projectiles.delete(projectile.id);
      }
    }

    if (localPlayer.hp <= 0 || opponentPlayer.hp <= 0) {
      this.latestResult = {
        winnerSlot: localPlayer.hp > 0 ? localPlayer.slot : opponentPlayer.slot,
        reason: "elimination"
      };
    } else if (this.elapsedMs >= MATCH_DURATION_MS) {
      this.latestResult = {
        winnerSlot:
          localPlayer.hp === opponentPlayer.hp
            ? null
            : localPlayer.hp > opponentPlayer.hp
              ? localPlayer.slot
              : opponentPlayer.slot,
        reason: "timeout"
      };
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
      fireCooldownRemaining: 0,
      lastHitAt: null,
      moveX: 0,
      moveZ: 0,
      pointerActive: false,
      totalDirectDamageDealt: 0
    };
  }

  private createSnapshot(): SessionSnapshot {
    const localPlayer = { ...this.players[this.localSlot] };
    const opponentPlayer = {
      ...this.players[this.localSlot === "A" ? "B" : "A"]
    };
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
        result: this.latestResult
      }
    };
  }

  private createMatchSnapshot(): SessionMatchSnapshot {
    const timeRemainingMs = Math.max(0, MATCH_DURATION_MS - this.elapsedMs);
    const phase: MatchPhase = this.latestResult === null ? "standard" : "finished";

    return {
      phase,
      timeRemainingMs,
      whiteoutRadius: ARENA_HALF_EXTENT,
      centerBonfireState: "idle",
      centerControlTime: { A: 0, B: 0 }
    };
  }

  private trySpawnProjectile(player: PlayerRuntimeState) {
    if (player.fireCooldownRemaining > 0) {
      return;
    }

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
      vx: directionX * PROJECTILE_SPEED,
      vz: directionZ * PROJECTILE_SPEED,
      traveled: 0,
      expiresAt: this.elapsedMs + PROJECTILE_TTL_MS
    });
    player.fireCooldownRemaining = FIRE_COOLDOWN_MS;
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
      hp: SOLO_WALL_HP,
      expiresAt: this.elapsedMs + SOLO_WALL_DURATION_MS,
      enabled: true
    });
    player.buildCooldownRemaining = SOLO_BUILD_COOLDOWN_MS;
    player.packedSnow -= SOLO_WALL_COST;
  }

  private applyDirectHit(source: PlayerRuntimeState, target: PlayerRuntimeState) {
    target.hp = Math.max(0, target.hp - SOLO_SNOWBALL_DAMAGE);
    target.snowLoad = clamp(target.snowLoad + SOLO_SNOWBALL_LOAD, 0, 100);
    target.lastHitAt = this.elapsedMs;
    target.slowMultiplier = 1 - getSlowPenalty(target.snowLoad);
    source.packedSnow = Math.min(
      SOLO_MAX_PACKED_SNOW,
      source.packedSnow + SOLO_PACKED_SNOW_ON_DIRECT_HIT
    );
    source.totalDirectDamageDealt += SOLO_SNOWBALL_DAMAGE;
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

  private updateBot(bot: PlayerRuntimeState, target: PlayerRuntimeState) {
    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const distance = Math.hypot(dx, dz);
    const directionX = distance > 0 ? dx / distance : 0;
    const directionZ = distance > 0 ? dz / distance : 0;
    const strafeSign = Math.sin(this.elapsedMs / 700) >= 0 ? 1 : -1;

    bot.aimX = target.x;
    bot.aimZ = target.z;
    bot.pointerActive = true;

    if (distance > 8.5) {
      bot.moveX = directionX;
      bot.moveZ = directionZ;
    } else if (distance < 5.5) {
      bot.moveX = -directionX * 0.7 + strafeSign * directionZ * 0.5;
      bot.moveZ = -directionZ * 0.7 - strafeSign * directionX * 0.5;
    } else {
      bot.moveX = strafeSign * directionZ * 0.7;
      bot.moveZ = -strafeSign * directionX * 0.7;
    }

    const length = Math.hypot(bot.moveX, bot.moveZ);
    if (length > 0.001) {
      bot.moveX /= length;
      bot.moveZ /= length;
    }

    if (distance <= SOLO_SNOWBALL_RANGE && bot.fireCooldownRemaining <= 0) {
      this.trySpawnProjectile(bot);
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSlowPenalty(snowLoad: number) {
  return Math.min(
    SOLO_MAX_SLOW_PENALTY,
    (snowLoad / 20) * SOLO_SNOW_LOAD_SLOW_PER_20
  );
}
