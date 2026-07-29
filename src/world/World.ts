import { Point } from "../utils/MathUtils";
import { isWalkableTile, Tile } from "./Tile";

export interface World {
  seed: string;
  name: string;
  width: number;
  height: number;
  tiles: Tile[];
  spawn: Point;
  version: number;
}

export function tileIndex(world: World, x: number, y: number): number {
  return y * world.width + x;
}

export function inBounds(world: World, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export function getTile(world: World, x: number, y: number): Tile | undefined {
  if (!inBounds(world, x, y)) return undefined;
  return world.tiles[tileIndex(world, x, y)];
}

export function requireTile(world: World, x: number, y: number): Tile {
  const tile = getTile(world, x, y);
  if (!tile) throw new Error(`Tile buiten wereld: ${x},${y}`);
  return tile;
}

export function setTileType(world: World, x: number, y: number, type: Tile["type"]): void {
  const tile = requireTile(world, x, y);
  tile.type = type;
  world.version += 1;
}

export function canStandAt(world: World, x: number, y: number): boolean {
  const tile = getTile(world, x, y);
  return Boolean(tile && isWalkableTile(tile));
}
