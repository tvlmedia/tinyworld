import { Point, clamp, hash2D, neighbors4, tileKey } from "../utils/MathUtils";
import { fbmNoise2D } from "./Noise";
import { SeededRandom } from "./SeededRandom";
import { isLand, isWater, Tile, TileType } from "./Tile";
import { getTile, inBounds, World } from "./World";

const NAME_PREFIXES = ["Elder", "Green", "Oak", "Silver", "Sun", "Mist", "Bright", "Fern"];
const NAME_SUFFIXES = ["vale", "mere", "holm", "reach", "haven", "wood", "isle", "brook"];

export interface WorldValidation {
  playable: boolean;
  landTiles: number;
  grassTiles: number;
  forestTiles: number;
  foodTiles: number;
  largestLandArea: number;
}

export function generateWorld(seed: string, size = 128): World {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const attemptSeed = attempt === 0 ? seed : `${seed}-retry-${attempt}`;
    const world = buildWorld(attemptSeed, size);
    const validation = validateWorld(world);
    if (validation.playable) return world;
  }

  const fallback = buildWorld(`${seed}-wide-island`, size, 0.08);
  enrichSpawnArea(fallback);
  return fallback;
}

export function validateWorld(world: World): WorldValidation {
  let landTiles = 0;
  let grassTiles = 0;
  let forestTiles = 0;
  let foodTiles = 0;

  for (const tile of world.tiles) {
    if (isLand(tile.type) && tile.type !== "mountain") landTiles += 1;
    if (tile.type === "grass" || tile.type === "farmland") grassTiles += 1;
    if (tile.type === "forest") forestTiles += 1;
    if (tile.resourceAmount > 0 && (tile.type === "grass" || tile.type === "farmland" || tile.type === "forest")) {
      foodTiles += 1;
    }
  }

  const largestLandArea = findLargestLandArea(world);
  const total = world.width * world.height;
  const playable =
    landTiles / total > 0.22 &&
    grassTiles > total * 0.08 &&
    forestTiles > total * 0.035 &&
    foodTiles > 24 &&
    largestLandArea > landTiles * 0.55 &&
    world.spawn.x > 0 &&
    world.spawn.y > 0;

  return { playable, landTiles, grassTiles, forestTiles, foodTiles, largestLandArea };
}

function buildWorld(seed: string, size: number, heightBias = 0): World {
  const seedHash = SeededRandom.hashSeed(seed);
  const rng = new SeededRandom(seed);
  const tiles: Tile[] = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const radial = Math.sqrt(nx * nx + ny * ny);
      const falloff = Math.pow(clamp(radial, 0, 1.35), 2.2);
      const broad = fbmNoise2D(x * 0.035, y * 0.035, seedHash, 4);
      const detail = fbmNoise2D(x * 0.11 + 30, y * 0.11 - 20, seedHash + 991, 3);
      const moisture = clamp(fbmNoise2D(x * 0.045 - 40, y * 0.045 + 15, seedHash + 17, 4), 0, 1);
      const temperature = clamp(1 - y / size + fbmNoise2D(x * 0.02, y * 0.02, seedHash + 73, 2) * 0.18, 0, 1);
      const elevation = clamp(broad * 0.82 + detail * 0.22 + 0.25 + heightBias - falloff * 0.72, 0, 1);
      const fertility = clamp((moisture * 0.55 + (1 - Math.abs(temperature - 0.55)) * 0.45) * (1 - elevation * 0.35), 0, 1);
      const type = chooseTileType(elevation, moisture, fertility, detail);
      const resourceAmount = initialResourceAmount(type, fertility, moisture, rng, x, y, seedHash);

      tiles.push({
        x,
        y,
        type,
        elevation,
        moisture,
        fertility,
        temperature,
        resourceAmount
      });
    }
  }

  const world: World = {
    seed,
    name: generateWorldName(rng),
    width: size,
    height: size,
    tiles,
    spawn: { x: Math.floor(size / 2), y: Math.floor(size / 2) },
    version: 0
  };

  addBeaches(world);
  world.spawn = findSpawn(world);
  enrichSpawnArea(world);
  return world;
}

function chooseTileType(elevation: number, moisture: number, fertility: number, detail: number): TileType {
  if (elevation < 0.24) return "deepWater";
  if (elevation < 0.34) return "water";
  if (elevation < 0.39) return "sand";
  if (elevation > 0.82) return "mountain";
  if (elevation > 0.72 && detail > 0.48) return "rock";
  if (fertility > 0.5 && moisture > 0.45) return "forest";
  return "grass";
}

function initialResourceAmount(
  type: TileType,
  fertility: number,
  moisture: number,
  rng: SeededRandom,
  x: number,
  y: number,
  seedHash: number
): number {
  const local = hash2D(x, y, seedHash);
  if (type === "forest") return 3 + Math.floor(local * 5);
  if (type === "rock") return 2 + Math.floor(local * 4);
  if (type === "grass" && fertility > 0.54 && moisture > 0.36 && rng.chance(0.18)) return 1 + Math.floor(local * 4);
  return 0;
}

function addBeaches(world: World): void {
  const toSand: Point[] = [];
  for (const tile of world.tiles) {
    if (!isLand(tile.type) || tile.type === "mountain" || tile.type === "rock") continue;
    if (neighbors4(tile).some((neighbor) => getTile(world, neighbor.x, neighbor.y) && isWater(getTile(world, neighbor.x, neighbor.y)!.type))) {
      toSand.push(tile);
    }
  }
  for (const point of toSand) {
    const tile = getTile(world, point.x, point.y);
    if (tile) {
      tile.type = "sand";
      tile.resourceAmount = 0;
    }
  }
}

function findSpawn(world: World): Point {
  const center = { x: world.width / 2, y: world.height / 2 };
  let best: Point = { x: -1, y: -1 };
  let bestScore = -Infinity;

  for (const tile of world.tiles) {
    if (tile.type !== "grass" && tile.type !== "forest") continue;
    const nearbyWater = neighbors4(tile).some((neighbor) => {
      const other = getTile(world, neighbor.x, neighbor.y);
      return other ? isWater(other.type) : true;
    });
    if (nearbyWater) continue;

    const neighborLand = neighbors4(tile).filter((neighbor) => {
      const other = getTile(world, neighbor.x, neighbor.y);
      return other && isLand(other.type) && other.type !== "mountain";
    }).length;
    const score = neighborLand * 16 - Math.hypot(tile.x - center.x, tile.y - center.y) + tile.fertility * 20;
    if (score > bestScore) {
      bestScore = score;
      best = { x: tile.x, y: tile.y };
    }
  }

  return best.x >= 0 ? best : { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) };
}

function enrichSpawnArea(world: World): void {
  const rng = new SeededRandom(`${world.seed}:spawn`);
  for (let y = world.spawn.y - 8; y <= world.spawn.y + 8; y += 1) {
    for (let x = world.spawn.x - 8; x <= world.spawn.x + 8; x += 1) {
      if (!inBounds(world, x, y)) continue;
      const tile = getTile(world, x, y);
      if (!tile || tile.type === "water" || tile.type === "deepWater" || tile.type === "mountain") continue;
      if (Math.hypot(x - world.spawn.x, y - world.spawn.y) < 4) {
        tile.type = "grass";
        tile.resourceAmount = Math.max(tile.resourceAmount, rng.chance(0.24) ? 2 : 0);
      } else if (rng.chance(0.08) && tile.type === "grass") {
        tile.resourceAmount = Math.max(tile.resourceAmount, 2);
      }
    }
  }
}

function findLargestLandArea(world: World): number {
  const visited = new Set<string>();
  let largest = 0;

  for (const tile of world.tiles) {
    if (visited.has(tileKey(tile.x, tile.y)) || !isLand(tile.type) || tile.type === "mountain") continue;
    let area = 0;
    const queue: Point[] = [{ x: tile.x, y: tile.y }];
    visited.add(tileKey(tile.x, tile.y));

    while (queue.length > 0) {
      const current = queue.shift()!;
      area += 1;
      for (const neighbor of neighbors4(current)) {
        const key = tileKey(neighbor.x, neighbor.y);
        const other = getTile(world, neighbor.x, neighbor.y);
        if (!other || visited.has(key) || !isLand(other.type) || other.type === "mountain") continue;
        visited.add(key);
        queue.push(neighbor);
      }
    }

    largest = Math.max(largest, area);
  }

  return largest;
}

function generateWorldName(rng: SeededRandom): string {
  return `${rng.pick(NAME_PREFIXES)}${rng.pick(NAME_SUFFIXES)}`;
}
