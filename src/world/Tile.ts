export type TileType =
  | "deepWater"
  | "water"
  | "sand"
  | "grass"
  | "forest"
  | "rock"
  | "mountain"
  | "farmland"
  | "road"
  | "burned";

export const TILE_TYPES: TileType[] = [
  "deepWater",
  "water",
  "sand",
  "grass",
  "forest",
  "rock",
  "mountain",
  "farmland",
  "road",
  "burned"
];

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  elevation: number;
  moisture: number;
  fertility: number;
  temperature: number;
  resourceAmount: number;
  occupiedByBuildingId?: string;
}

export function isWater(type: TileType): boolean {
  return type === "deepWater" || type === "water";
}

export function isWalkableTile(tile: Tile, allowOccupiedBy?: string): boolean {
  if (tile.occupiedByBuildingId && tile.occupiedByBuildingId !== allowOccupiedBy) return false;
  return tile.type !== "deepWater" && tile.type !== "water" && tile.type !== "mountain";
}

export function movementCost(tile: Tile): number {
  switch (tile.type) {
    case "road":
      return 0.55;
    case "sand":
      return 1.25;
    case "forest":
      return 1.45;
    case "rock":
      return 1.8;
    case "farmland":
      return 0.9;
    case "burned":
      return 1.35;
    default:
      return 1;
  }
}

export function isLand(type: TileType): boolean {
  return !isWater(type);
}
