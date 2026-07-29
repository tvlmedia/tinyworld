import type { Building } from "../entities/Building";
import type { GameState } from "../app/GameState";
import { Point, neighbors4 } from "../utils/MathUtils";
import { isLand, isWater } from "./Tile";
import { getTile, tileIndex, World } from "./World";

const componentCache = new WeakMap<World, Int32Array>();
type WorldPoint = Point | { centerX: number; centerY: number };

export function areLandConnected(world: World, a: WorldPoint, b: WorldPoint): boolean {
  const pointA = normalizePoint(a);
  const pointB = normalizePoint(b);
  const aTile = getTile(world, Math.floor(pointA.x), Math.floor(pointA.y));
  const bTile = getTile(world, Math.floor(pointB.x), Math.floor(pointB.y));
  if (!aTile || !bTile || !isLand(aTile.type) || !isLand(bTile.type)) return false;
  const components = landComponents(world);
  const aComponent = components[tileIndex(world, aTile.x, aTile.y)];
  return aComponent > 0 && aComponent === components[tileIndex(world, bTile.x, bTile.y)];
}

function normalizePoint(point: WorldPoint): Point {
  return "centerX" in point ? { x: point.centerX, y: point.centerY } : point;
}

export function countLandComponents(world: World, minimumSize = 1): number {
  const components = landComponents(world);
  const sizes = new Map<number, number>();
  for (const component of components) {
    if (component > 0) sizes.set(component, (sizes.get(component) ?? 0) + 1);
  }
  return [...sizes.values()].filter((size) => size >= minimumSize).length;
}

export function isCoastal(world: World, point: Point, radius = 7): boolean {
  for (let y = Math.floor(point.y) - radius; y <= Math.floor(point.y) + radius; y += 1) {
    for (let x = Math.floor(point.x) - radius; x <= Math.floor(point.x) + radius; x += 1) {
      if (isWater(getTile(world, x, y)?.type ?? "grass")) return true;
    }
  }
  return false;
}

export function hasHarbor(state: GameState, settlementId: string): boolean {
  return state.buildings.some(
    (building) => building.settlementId === settlementId && building.type === "harbor" && building.status === "complete"
  );
}

export function harborWaterAccess(state: GameState, harbor: Building): Point | undefined {
  for (let radius = 1; radius <= 8; radius += 1) {
    for (let y = harbor.y - radius; y < harbor.y + harbor.height + radius; y += 1) {
      for (let x = harbor.x - radius; x < harbor.x + harbor.width + radius; x += 1) {
        const onRing =
          x === harbor.x - radius ||
          x === harbor.x + harbor.width + radius - 1 ||
          y === harbor.y - radius ||
          y === harbor.y + harbor.height + radius - 1;
        if (onRing && isWater(getTile(state.world, x, y)?.type ?? "grass")) return { x, y };
      }
    }
  }
  return undefined;
}

function landComponents(world: World): Int32Array {
  const cached = componentCache.get(world);
  if (cached) return cached;
  const components = new Int32Array(world.width * world.height);
  let component = 0;
  for (const tile of world.tiles) {
    const index = tileIndex(world, tile.x, tile.y);
    if (components[index] !== 0 || !isLand(tile.type) || tile.type === "mountain") continue;
    component += 1;
    const queue: Point[] = [{ x: tile.x, y: tile.y }];
    components[index] = component;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const neighbor of neighbors4(queue[cursor])) {
        const other = getTile(world, neighbor.x, neighbor.y);
        if (!other || !isLand(other.type) || other.type === "mountain") continue;
        const otherIndex = tileIndex(world, other.x, other.y);
        if (components[otherIndex] !== 0) continue;
        components[otherIndex] = component;
        queue.push(neighbor);
      }
    }
  }
  componentCache.set(world, components);
  return components;
}
