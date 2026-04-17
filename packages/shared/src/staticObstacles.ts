export type StaticObstacleKind = "rock" | "tree";

export type StaticObstacleModelKey =
  | "rocks-large"
  | "rocks-medium"
  | "rocks-small"
  | "tree-snow-a"
  | "tree-snow-b"
  | "tree-snow-c";

export interface StaticArenaObstacle {
  blockingRadius: number;
  id: string;
  kind: StaticObstacleKind;
  modelKey: StaticObstacleModelKey;
  rotationY: number;
  visualHeight: number;
  visualRadius: number;
  x: number;
  z: number;
}

export const STATIC_ARENA_OBSTACLES: readonly StaticArenaObstacle[] = [
  {
    blockingRadius: 2.34,
    id: "tree-northwest",
    kind: "tree",
    modelKey: "tree-snow-a",
    rotationY: 0.3,
    visualHeight: 4.4,
    visualRadius: 1.35,
    x: -8.5,
    z: -5.5
  },
  {
    blockingRadius: 2.4,
    id: "tree-east",
    kind: "tree",
    modelKey: "tree-snow-b",
    rotationY: 1.2,
    visualHeight: 4.8,
    visualRadius: 1.35,
    x: 8.75,
    z: -3.75
  },
  {
    blockingRadius: 2.16,
    id: "tree-southwest",
    kind: "tree",
    modelKey: "tree-snow-c",
    rotationY: 2.6,
    visualHeight: 4.1,
    visualRadius: 1.2,
    x: -6.75,
    z: 7.8
  },
  {
    blockingRadius: 1.86,
    id: "rock-northeast",
    kind: "rock",
    modelKey: "rocks-small",
    rotationY: 0.8,
    visualHeight: 2.2,
    visualRadius: 1,
    x: 6.9,
    z: 8.4
  },
  {
    blockingRadius: 1.98,
    id: "rock-west",
    kind: "rock",
    modelKey: "rocks-medium",
    rotationY: 1.9,
    visualHeight: 2.5,
    visualRadius: 1.05,
    x: -10.4,
    z: 2.5
  },
  {
    blockingRadius: 2.16,
    id: "rock-southeast",
    kind: "rock",
    modelKey: "rocks-large",
    rotationY: 2.2,
    visualHeight: 2.8,
    visualRadius: 1.15,
    x: 10.8,
    z: -9.2
  }
] as const;
