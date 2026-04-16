import {
  ARENA_HALF_EXTENT,
  FIRE_COOLDOWN_MS,
  PLAYER_SPEED,
  PLAYER_SPAWN_OFFSET,
  PROJECTILE_SPEED,
  PROJECTILE_TTL_MS,
  PROJECTILE_SPAWN_DISTANCE,
  SOLO_MATCH_DURATION_MS,
  SOLO_BONFIRE_CAPTURE_MS,
  SOLO_BONFIRE_DURATION_MS,
  SOLO_BONFIRE_PACKED_SNOW_REWARD,
  SOLO_BONFIRE_RADIUS,
  SOLO_BONFIRE_SNOW_LOAD_REWARD,
  SOLO_BUILD_COOLDOWN_MS,
  SOLO_FINAL_PUSH_START_MS,
  SOLO_HEATER_BEACON_COST,
  SOLO_HEATER_BEACON_DURATION_MS,
  SOLO_HEATER_BEACON_HP,
  SOLO_HEATER_BEACON_RADIUS,
  SOLO_MAX_PACKED_SNOW,
  SOLO_MAX_SLOW_PENALTY,
  SOLO_MAX_WALLS,
  SOLO_PACKED_SNOW_ON_DIRECT_HIT,
  SOLO_PACKED_SNOW_REGEN_PER_SECOND,
  SOLO_SNOWBALL_DAMAGE,
  SOLO_SNOWBALL_LOAD,
  SOLO_SNOWBALL_RANGE,
  SOLO_SNOW_LOAD_MELT_DELAY_MS,
  SOLO_SNOW_LOAD_MELT_PER_SECOND,
  SOLO_SNOW_LOAD_SLOW_PER_20,
  SOLO_SNOWMAN_TURRET_COST,
  SOLO_SNOWMAN_TURRET_DURATION_MS,
  SOLO_SNOWMAN_TURRET_HP,
  SOLO_SNOWMAN_TURRET_INTERVAL_MS,
  SOLO_SNOWMAN_TURRET_LOAD,
  SOLO_SNOWMAN_TURRET_RANGE,
  SOLO_SPAWN_EXCLUSION_RADIUS,
  SOLO_SPAWN_RANGE,
  SOLO_STRUCTURE_COLLISION_RADIUS,
  SOLO_WALL_COST,
  SOLO_WALL_DURATION_MS,
  SOLO_WALL_HALF_DEPTH,
  SOLO_WALL_HALF_WIDTH,
  SOLO_WALL_HP,
  SOLO_WHITEOUT_CENTER_CONTROL_RADIUS,
  SOLO_WHITEOUT_PLAYER_DAMAGE_PER_SECOND,
  SOLO_WHITEOUT_START_MS,
  SOLO_WHITEOUT_STRUCTURE_DAMAGE_PER_SECOND,
  SOLO_WHITEOUT_TARGET_RADIUS
} from "./constants";
import type {
  BuildType,
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

interface StructureRuntimeState extends SessionStructureSnapshot {
  nextFireAt: number;
}

interface BonfireRuntimeState {
  activeUntil: number;
  activationStart: number | null;
  captureMs: Record<SlotId, number>;
  claimedBy: SlotId | null;
}

export interface SoloRulesEngineOptions {
  botEnabled?: boolean;
  localSlot?: SlotId;
}

const BONFIRE_ACTIVATIONS = [75_000, 135_000];
const HEATER_OR_TURRET_LIMIT = 1;

export class SoloRulesEngine {
  private readonly botEnabled: boolean;
  private readonly bonfire: BonfireRuntimeState = {
    activeUntil: 0,
    activationStart: null,
    captureMs: { A: 0, B: 0 },
    claimedBy: null
  };
  private readonly centerControlTime: Record<SlotId, number> = { A: 0, B: 0 };
  private elapsedMs = 0;
  private latestResult: SessionResultSnapshot | null = null;
  private latestSnapshot: SessionSnapshot;
  private projectileCounter = 0;
  private readonly localSlot: SlotId;
  private readonly players: Record<SlotId, PlayerRuntimeState>;
  private readonly projectiles = new Map<string, ProjectileRuntimeState>();
  private readonly structures = new Map<string, StructureRuntimeState>();

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
      if (player.selectedBuild !== null) {
        this.trySpawnStructure(player, player.selectedBuild);
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

    this.elapsedMs = Math.min(SOLO_MATCH_DURATION_MS, this.elapsedMs + deltaMs);
    const localPlayer = this.players[this.localSlot];
    const opponentPlayer = this.players[this.localSlot === "A" ? "B" : "A"];
    const deltaSeconds = deltaMs / 1000;
    const phase = this.getCurrentPhase();
    const whiteoutRadius = this.getWhiteoutRadius();

    this.updateBonfire(deltaMs);

    if (this.botEnabled) {
      this.updateBot(opponentPlayer, localPlayer, phase, whiteoutRadius);
    }

    for (const player of Object.values(this.players)) {
      player.buildCooldownRemaining = Math.max(0, player.buildCooldownRemaining - deltaMs);
      player.fireCooldownRemaining = Math.max(0, player.fireCooldownRemaining - deltaMs);
      player.packedSnow = Math.min(
        SOLO_MAX_PACKED_SNOW,
        player.packedSnow + deltaSeconds * SOLO_PACKED_SNOW_REGEN_PER_SECOND
      );

      const meltRate = this.isInsideFriendlyHeater(player)
        ? SOLO_SNOW_LOAD_MELT_PER_SECOND + 6
        : SOLO_SNOW_LOAD_MELT_PER_SECOND;

      if (
        player.lastHitAt !== null &&
        this.elapsedMs - player.lastHitAt >= SOLO_SNOW_LOAD_MELT_DELAY_MS
      ) {
        player.snowLoad = Math.max(0, player.snowLoad - deltaSeconds * meltRate);
      }

      player.slowMultiplier = 1 - getSlowPenalty(player.snowLoad);

      const moveSpeed = PLAYER_SPEED * player.slowMultiplier;
      const desiredX = clamp(
        player.x + player.moveX * deltaSeconds * moveSpeed,
        -ARENA_HALF_EXTENT,
        ARENA_HALF_EXTENT
      );
      const desiredZ = clamp(
        player.z + player.moveZ * deltaSeconds * moveSpeed,
        -ARENA_HALF_EXTENT,
        ARENA_HALF_EXTENT
      );
      const resolved = this.resolveWallMovement(player, desiredX, desiredZ);
      player.x = resolved.x;
      player.z = resolved.z;

      const aimX = player.pointerActive ? player.aimX - player.x : 0;
      const aimZ = player.pointerActive
        ? player.aimZ - player.z
        : player.slot === "A"
          ? -1
          : 1;

      if (Math.hypot(aimX, aimZ) > 0.001) {
        player.facingAngle = Math.atan2(aimX, aimZ);
      }

      if (phase !== "standard") {
        if (Math.hypot(player.x, player.z) > whiteoutRadius) {
          player.hp = Math.max(
            0,
            player.hp - deltaSeconds * SOLO_WHITEOUT_PLAYER_DAMAGE_PER_SECOND
          );
        }
      }

      if (
        phase === "whiteout" &&
        Math.hypot(player.x, player.z) <= SOLO_WHITEOUT_CENTER_CONTROL_RADIUS
      ) {
        this.centerControlTime[player.slot] += deltaMs;
      }
    }

    this.updateStructures(phase, whiteoutRadius, deltaSeconds);
    this.updateProjectiles(deltaSeconds);
    this.updateBonfireCapture(deltaMs);

    if (localPlayer.hp <= 0 || opponentPlayer.hp <= 0) {
      this.latestResult = {
        winnerSlot: localPlayer.hp > 0 ? localPlayer.slot : opponentPlayer.slot,
        reason: "elimination"
      };
    } else if (this.elapsedMs >= SOLO_MATCH_DURATION_MS) {
      this.latestResult = this.resolveTimeout(localPlayer, opponentPlayer);
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

    return {
      localPlayer,
      opponentPlayer,
      structures: [...this.structures.values()].map((structure) => ({ ...structure })),
      projectiles: [...this.projectiles.values()].map((projectile) => ({
        id: projectile.id,
        ownerSlot: projectile.ownerSlot,
        x: projectile.x,
        z: projectile.z,
        expiresAt: projectile.expiresAt
      })),
      match: this.createMatchSnapshot(),
      hud: {
        activeBonfire:
          this.bonfire.activationStart !== null && this.bonfire.claimedBy === null,
        buildPreviewValid: this.isBuildPreviewValid(localPlayer, localPlayer.selectedBuild),
        cursorX: localPlayer.aimX,
        cursorZ: localPlayer.aimZ,
        pointerActive: localPlayer.pointerActive,
        result: this.latestResult
      }
    };
  }

  private createMatchSnapshot(): SessionMatchSnapshot {
    const phase = this.latestResult === null ? this.getCurrentPhase() : "finished";

    return {
      phase,
      timeRemainingMs: Math.max(0, SOLO_MATCH_DURATION_MS - this.elapsedMs),
      whiteoutRadius: this.getWhiteoutRadius(),
      centerBonfireState:
        this.bonfire.claimedBy !== null
          ? "claimed"
          : this.bonfire.activationStart !== null
            ? "active"
            : "idle",
      centerControlTime: {
        A: this.centerControlTime.A,
        B: this.centerControlTime.B
      }
    };
  }

  private getCurrentPhase(): MatchPhase {
    if (this.elapsedMs >= SOLO_FINAL_PUSH_START_MS) {
      return "final_push";
    }

    if (this.elapsedMs >= SOLO_WHITEOUT_START_MS) {
      return "whiteout";
    }

    return "standard";
  }

  private getWhiteoutRadius() {
    if (this.elapsedMs < SOLO_WHITEOUT_START_MS) {
      return ARENA_HALF_EXTENT;
    }

    if (this.elapsedMs >= SOLO_FINAL_PUSH_START_MS) {
      return SOLO_WHITEOUT_TARGET_RADIUS;
    }

    const progress =
      (this.elapsedMs - SOLO_WHITEOUT_START_MS) /
      (SOLO_FINAL_PUSH_START_MS - SOLO_WHITEOUT_START_MS);
    return (
      ARENA_HALF_EXTENT -
      (ARENA_HALF_EXTENT - SOLO_WHITEOUT_TARGET_RADIUS) * progress
    );
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

  private trySpawnStructure(player: PlayerRuntimeState, buildType: BuildType) {
    if (this.getCurrentPhase() === "final_push") {
      return;
    }

    const cost = getBuildCost(buildType);
    if (player.buildCooldownRemaining > 0 || player.packedSnow < cost) {
      return;
    }

    if (!this.isBuildPreviewValid(player, buildType)) {
      return;
    }

    const activeOwned = [...this.structures.values()].filter(
      (structure) => structure.ownerSlot === player.slot && structure.type === buildType
    );
    const maxCount = buildType === "wall" ? SOLO_MAX_WALLS : HEATER_OR_TURRET_LIMIT;
    if (activeOwned.length >= maxCount) {
      return;
    }

    const id = `${buildType}-${player.slot}-${this.structures.size + 1}`;
    this.structures.set(id, {
      id,
      type: buildType,
      ownerSlot: player.slot,
      x: player.aimX,
      z: player.aimZ,
      hp: getStructureHp(buildType),
      expiresAt: this.elapsedMs + getStructureDuration(buildType),
      enabled: true,
      nextFireAt: this.elapsedMs + SOLO_SNOWMAN_TURRET_INTERVAL_MS
    });
    player.buildCooldownRemaining = SOLO_BUILD_COOLDOWN_MS;
    player.packedSnow -= cost;
  }

  private updateStructures(
    phase: MatchPhase,
    whiteoutRadius: number,
    deltaSeconds: number
  ) {
    for (const structure of this.structures.values()) {
      if (phase !== "standard" && Math.hypot(structure.x, structure.z) > whiteoutRadius) {
        structure.hp = Math.max(
          0,
          structure.hp - deltaSeconds * SOLO_WHITEOUT_STRUCTURE_DAMAGE_PER_SECOND
        );
      }

      if (!structure.enabled || structure.expiresAt <= this.elapsedMs || structure.hp <= 0) {
        this.structures.delete(structure.id);
        continue;
      }

      if (structure.type !== "snowman_turret" || structure.nextFireAt > this.elapsedMs) {
        continue;
      }

      const target = this.players[structure.ownerSlot === "A" ? "B" : "A"];
      const distance = Math.hypot(target.x - structure.x, target.z - structure.z);

      if (distance <= SOLO_SNOWMAN_TURRET_RANGE && this.hasLineOfSight(structure, target)) {
        target.snowLoad = clamp(target.snowLoad + SOLO_SNOWMAN_TURRET_LOAD, 0, 100);
        target.lastHitAt = this.elapsedMs;
        target.slowMultiplier = 1 - getSlowPenalty(target.snowLoad);
      }

      structure.nextFireAt = this.elapsedMs + SOLO_SNOWMAN_TURRET_INTERVAL_MS;
    }
  }

  private updateProjectiles(deltaSeconds: number) {
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

      const hitStructure = this.findHitStructure(projectile.x, projectile.z);
      if (hitStructure) {
        hitStructure.hp = Math.max(0, hitStructure.hp - SOLO_SNOWBALL_DAMAGE);
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
  }

  private updateBonfire(deltaMs: number) {
    if (
      this.bonfire.activationStart !== null &&
      this.elapsedMs >= this.bonfire.activeUntil
    ) {
      this.bonfire.activationStart = null;
      this.bonfire.activeUntil = 0;
      this.bonfire.captureMs = { A: 0, B: 0 };
      this.bonfire.claimedBy = null;
      return;
    }

    if (this.bonfire.activationStart !== null) {
      return;
    }

    const activation = BONFIRE_ACTIVATIONS.find(
      (startAt) => this.elapsedMs >= startAt && this.elapsedMs < startAt + deltaMs
    );

    if (activation === undefined) {
      return;
    }

    this.bonfire.activationStart = activation;
    this.bonfire.activeUntil = activation + SOLO_BONFIRE_DURATION_MS;
    this.bonfire.captureMs = { A: 0, B: 0 };
    this.bonfire.claimedBy = null;
  }

  private updateBonfireCapture(deltaMs: number) {
    if (this.bonfire.activationStart === null || this.bonfire.claimedBy !== null) {
      return;
    }

    for (const player of Object.values(this.players)) {
      const distance = Math.hypot(player.x, player.z);
      if (distance > SOLO_BONFIRE_RADIUS) {
        this.bonfire.captureMs[player.slot] = 0;
        continue;
      }

      this.bonfire.captureMs[player.slot] += deltaMs;
      if (this.bonfire.captureMs[player.slot] < SOLO_BONFIRE_CAPTURE_MS) {
        continue;
      }

      player.snowLoad = Math.max(0, player.snowLoad - SOLO_BONFIRE_SNOW_LOAD_REWARD);
      player.packedSnow = Math.min(
        SOLO_MAX_PACKED_SNOW,
        player.packedSnow + SOLO_BONFIRE_PACKED_SNOW_REWARD
      );
      this.bonfire.claimedBy = player.slot;
      break;
    }
  }

  private resolveWallMovement(
    player: PlayerRuntimeState,
    nextX: number,
    nextZ: number
  ) {
    let resolvedX = nextX;

    for (const structure of this.structures.values()) {
      if (structure.type !== "wall") {
        continue;
      }

      if (circleIntersectsWall(resolvedX, player.z, 0.9, structure.x, structure.z)) {
        resolvedX = player.x;
        break;
      }
    }

    let resolvedZ = nextZ;

    for (const structure of this.structures.values()) {
      if (structure.type !== "wall") {
        continue;
      }

      if (circleIntersectsWall(resolvedX, resolvedZ, 0.9, structure.x, structure.z)) {
        resolvedZ = player.z;
        break;
      }
    }

    return { x: resolvedX, z: resolvedZ };
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

  private resolveTimeout(
    localPlayer: PlayerRuntimeState,
    opponentPlayer: PlayerRuntimeState
  ): SessionResultSnapshot {
    if (localPlayer.hp !== opponentPlayer.hp) {
      return {
        winnerSlot: localPlayer.hp > opponentPlayer.hp ? localPlayer.slot : opponentPlayer.slot,
        reason: "timeout"
      };
    }

    if (localPlayer.snowLoad !== opponentPlayer.snowLoad) {
      return {
        winnerSlot:
          localPlayer.snowLoad < opponentPlayer.snowLoad
            ? localPlayer.slot
            : opponentPlayer.slot,
        reason: "timeout"
      };
    }

    if (localPlayer.totalDirectDamageDealt !== opponentPlayer.totalDirectDamageDealt) {
      return {
        winnerSlot:
          localPlayer.totalDirectDamageDealt > opponentPlayer.totalDirectDamageDealt
            ? localPlayer.slot
            : opponentPlayer.slot,
        reason: "timeout"
      };
    }

    if (this.centerControlTime.A !== this.centerControlTime.B) {
      return {
        winnerSlot:
          this.centerControlTime.A > this.centerControlTime.B ? "A" : "B",
        reason: "timeout"
      };
    }

    return { winnerSlot: null, reason: "timeout" };
  }

  private isInsideFriendlyHeater(player: PlayerRuntimeState) {
    return [...this.structures.values()].some(
      (structure) =>
        structure.type === "heater_beacon" &&
        structure.ownerSlot === player.slot &&
        Math.hypot(structure.x - player.x, structure.z - player.z) <=
          SOLO_HEATER_BEACON_RADIUS
    );
  }

  private isBuildPreviewValid(
    player: PlayerRuntimeState,
    buildType: BuildType | null
  ) {
    if (buildType === null || this.getCurrentPhase() === "final_push") {
      return false;
    }

    const cost = getBuildCost(buildType);
    if (player.buildCooldownRemaining > 0 || player.packedSnow < cost) {
      return false;
    }

    const distance = Math.hypot(player.aimX - player.x, player.aimZ - player.z);
    if (distance > SOLO_SPAWN_RANGE) {
      return false;
    }

    const spawnDistance = Math.min(
      Math.hypot(player.aimX, player.aimZ - PLAYER_SPAWN_OFFSET),
      Math.hypot(player.aimX, player.aimZ + PLAYER_SPAWN_OFFSET)
    );
    if (spawnDistance < SOLO_SPAWN_EXCLUSION_RADIUS) {
      return false;
    }

    if (
      Object.values(this.players).some(
        (runtime) => Math.hypot(runtime.x - player.aimX, runtime.z - player.aimZ) < 1.5
      )
    ) {
      return false;
    }

    return ![...this.structures.values()].some(
      (structure) =>
        Math.hypot(structure.x - player.aimX, structure.z - player.aimZ) <
        SOLO_STRUCTURE_COLLISION_RADIUS * 2
    );
  }

  private findHitStructure(projectileX: number, projectileZ: number) {
    return [...this.structures.values()].find((structure) => {
      if (structure.type === "wall") {
        return circleIntersectsWall(projectileX, projectileZ, 0.28, structure.x, structure.z);
      }

      return (
        Math.hypot(structure.x - projectileX, structure.z - projectileZ) <=
        SOLO_STRUCTURE_COLLISION_RADIUS
      );
    });
  }

  private hasLineOfSight(structure: StructureRuntimeState, target: PlayerRuntimeState) {
    return ![...this.structures.values()].some((candidate) => {
      if (candidate.type !== "wall") {
        return false;
      }

      return segmentHitsWall(
        structure.x,
        structure.z,
        target.x,
        target.z,
        candidate.x,
        candidate.z
      );
    });
  }

  private updateBot(
    bot: PlayerRuntimeState,
    target: PlayerRuntimeState,
    phase: MatchPhase,
    whiteoutRadius: number
  ) {
    const activeBonfire =
      this.bonfire.activationStart !== null && this.bonfire.claimedBy === null;

    if (
      activeBonfire &&
      (bot.snowLoad >= 30 || bot.packedSnow <= 55) &&
      Math.hypot(bot.x, bot.z) > SOLO_BONFIRE_RADIUS * 0.5
    ) {
      bot.aimX = 0;
      bot.aimZ = 0;
      const toCenter = Math.hypot(-bot.x, -bot.z) || 1;
      bot.moveX = -bot.x / toCenter;
      bot.moveZ = -bot.z / toCenter;
      return;
    }

    if (phase !== "standard" && Math.hypot(bot.x, bot.z) > whiteoutRadius) {
      const toCenter = Math.hypot(-bot.x, -bot.z) || 1;
      bot.moveX = -bot.x / toCenter;
      bot.moveZ = -bot.z / toCenter;
      bot.aimX = target.x;
      bot.aimZ = target.z;
      bot.pointerActive = true;
      return;
    }

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

function getBuildCost(buildType: BuildType) {
  if (buildType === "wall") {
    return SOLO_WALL_COST;
  }

  if (buildType === "snowman_turret") {
    return SOLO_SNOWMAN_TURRET_COST;
  }

  return SOLO_HEATER_BEACON_COST;
}

function getStructureDuration(buildType: BuildType) {
  if (buildType === "wall") {
    return SOLO_WALL_DURATION_MS;
  }

  if (buildType === "snowman_turret") {
    return SOLO_SNOWMAN_TURRET_DURATION_MS;
  }

  return SOLO_HEATER_BEACON_DURATION_MS;
}

function getStructureHp(buildType: BuildType) {
  if (buildType === "wall") {
    return SOLO_WALL_HP;
  }

  if (buildType === "snowman_turret") {
    return SOLO_SNOWMAN_TURRET_HP;
  }

  return SOLO_HEATER_BEACON_HP;
}

function getSlowPenalty(snowLoad: number) {
  return Math.min(
    SOLO_MAX_SLOW_PENALTY,
    (snowLoad / 20) * SOLO_SNOW_LOAD_SLOW_PER_20
  );
}

function circleIntersectsWall(
  x: number,
  z: number,
  radius: number,
  wallX: number,
  wallZ: number
) {
  const closestX = clamp(x, wallX - SOLO_WALL_HALF_WIDTH, wallX + SOLO_WALL_HALF_WIDTH);
  const closestZ = clamp(z, wallZ - SOLO_WALL_HALF_DEPTH, wallZ + SOLO_WALL_HALF_DEPTH);
  const dx = x - closestX;
  const dz = z - closestZ;

  return dx * dx + dz * dz <= radius * radius;
}

function segmentHitsWall(
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  wallX: number,
  wallZ: number
) {
  const steps = 8;

  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const x = startX + (endX - startX) * t;
    const z = startZ + (endZ - startZ) * t;

    if (circleIntersectsWall(x, z, 0.18, wallX, wallZ)) {
      return true;
    }
  }

  return false;
}
