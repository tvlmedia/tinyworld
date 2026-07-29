import { Point, clamp, hash2D, neighbors4, tileKey } from "../utils/MathUtils";
import { fbmNoise2D } from "./Noise";
import { SeededRandom } from "./SeededRandom";
import { isLand, isWater, Tile, TileType } from "./Tile";
import { getTile, inBounds, World, WorldGenerationStyle } from "./World";

const NAME_PREFIXES = ["Elder", "Green", "Oak", "Silver", "Sun", "Mist", "Bright", "Fern"];
const NAME_SUFFIXES = ["vale", "mere", "holm", "reach", "haven", "wood", "isle", "brook"];

export interface WorldValidation {
  playable: boolean;
  landTiles: number;
  grassTiles: number;
  forestTiles: number;
  foodTiles: number;
  largestLandArea: number;
  majorLandComponents: number;
}

export function generateWorld(seed: string, size = 128): World {
  const generationStyle = chooseGenerationStyle(seed, size);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const attemptSeed = attempt === 0 ? `${seed}:${size}` : `${seed}:${size}:retry-${attempt}`;
    const world = buildWorld(attemptSeed, size, 0, seed, generationStyle);
    const validation = validateWorld(world);
    if (validation.playable) return world;
  }

  const fallbackStyle = generationStyle === "archipelago" || generationStyle === "islandChain" ? generationStyle : "continent";
  const fallback = buildWorld(`${seed}:${size}:wide-island`, size, 0.05, seed, fallbackStyle);
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

  const landAreas = findLandAreas(world);
  const largestLandArea = landAreas[0] ?? 0;
  const total = world.width * world.height;
  const majorLandComponents = landAreas.filter((area) => area >= total * 0.008).length;
  const fragmented = world.generationStyle === "archipelago" || world.generationStyle === "islandChain";
  const componentRequirement = world.generationStyle === "archipelago" ? 3 : world.generationStyle === "islandChain" ? 2 : 1;
  const playable =
    landTiles / total > (fragmented ? 0.18 : 0.22) &&
    grassTiles > total * 0.08 &&
    forestTiles > total * 0.035 &&
    foodTiles > 24 &&
    largestLandArea > landTiles * (fragmented ? 0.1 : world.width >= 256 ? 0.32 : 0.5) &&
    majorLandComponents >= componentRequirement &&
    world.spawn.x > 0 &&
    world.spawn.y > 0;

  return { playable, landTiles, grassTiles, forestTiles, foodTiles, largestLandArea, majorLandComponents };
}

interface IslandBlob {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  strength: number;
}

function buildWorld(
  seed: string,
  size: number,
  heightBias = 0,
  displaySeed = seed,
  generationStyle: WorldGenerationStyle = "continent"
): World {
  const seedHash = SeededRandom.hashSeed(seed);
  const rng = new SeededRandom(seed);
  const tiles: Tile[] = [];
  const scale = worldScale(size);
  const islandBlobs = createIslandBlobs(generationStyle, rng);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / Math.max(1, size - 1);
      const v = y / Math.max(1, size - 1);
      const nx = (x / (size - 1)) * 2 - 1;
      const ny = (y / (size - 1)) * 2 - 1;
      const radial = Math.sqrt(nx * nx + ny * ny);
      const falloff = Math.pow(clamp(radial, 0, 1.38), 2.35);
      const continent = fbmNoise2D(u * 2.1 + 8, v * 2.1 - 3, seedHash, 5);
      const region = fbmNoise2D(u * scale.region + 31, v * scale.region - 22, seedHash + 311, 4);
      const detail = fbmNoise2D(u * scale.detail + 30, v * scale.detail - 20, seedHash + 991, 3);
      const mountainField = fbmNoise2D(u * scale.mountains - 18, v * scale.mountains + 7, seedHash + 621, 4);
      const lakeField = fbmNoise2D(u * scale.lakes + 13, v * scale.lakes + 41, seedHash + 817, 3);
      const moisture = clamp(fbmNoise2D(u * scale.moisture - 40, v * scale.moisture + 15, seedHash + 17, 4), 0, 1);
      const temperature = clamp(1 - v + fbmNoise2D(u * 3.2, v * 3.2, seedHash + 73, 2) * 0.18, 0, 1);
      const lakeCut = lakeField > 0.68 && moisture > 0.54 && elevationBand(continent, region) < 0.68 ? 0.13 : 0;
      const geography = geographyElevation(generationStyle, nx, ny, radial, falloff, islandBlobs);
      const elevation = clamp(
        continent * geography.continentWeight +
          region * geography.regionWeight +
          detail * 0.08 +
          mountainField * geography.mountainWeight +
          geography.base +
          heightBias -
          geography.waterCut * (size >= 512 ? 0.92 : 1) -
          lakeCut,
        0,
        1
      );
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
    seed: displaySeed,
    name: generateWorldName(rng),
    generationStyle,
    width: size,
    height: size,
    tiles,
    spawn: { x: Math.floor(size / 2), y: Math.floor(size / 2) },
    version: 0
  };

  if (generationStyle === "continent" || generationStyle === "inlandSea") carveSeaStraits(world);
  addMountainRanges(world, seedHash);
  carveRivers(world, seedHash);
  addBeaches(world);
  world.spawn = findSpawn(world);
  enrichSpawnArea(world);
  return world;
}

function chooseGenerationStyle(seed: string, size: number): WorldGenerationStyle {
  const normalized = seed.toLowerCase();
  if (normalized.includes("archipelago") || normalized.includes("archipel")) return "archipelago";
  if (normalized.includes("island") || normalized.includes("eiland")) return "islandChain";
  if (normalized.includes("inland-sea") || normalized.includes("binnenzee")) return "inlandSea";
  if (!seed.startsWith("World-")) return "continent";
  const rng = new SeededRandom(`${seed}:${size}:geography-style`);
  const roll = rng.next();
  if (roll < 0.32) return "continent";
  if (roll < 0.64) return "archipelago";
  if (roll < 0.84) return "islandChain";
  return "inlandSea";
}

function createIslandBlobs(style: WorldGenerationStyle, rng: SeededRandom): IslandBlob[] {
  if (style !== "archipelago" && style !== "islandChain") return [];
  const blobs: IslandBlob[] = [];
  if (style === "archipelago") {
    const count = rng.int(8, 12);
    for (let index = 0; index < count; index += 1) {
      blobs.push({
        x: rng.float(-0.72, 0.72),
        y: rng.float(-0.72, 0.72),
        radiusX: rng.float(0.2, 0.38),
        radiusY: rng.float(0.18, 0.34),
        strength: rng.float(0.88, 1.08)
      });
    }
    return blobs;
  }

  const vertical = rng.chance(0.5);
  const phase = rng.float(0, Math.PI * 2);
  const count = rng.int(7, 10);
  for (let index = 0; index < count; index += 1) {
    const progress = count === 1 ? 0.5 : index / (count - 1);
    const along = -0.78 + progress * 1.56;
    const cross = Math.sin(progress * Math.PI * 2 + phase) * 0.22 + rng.float(-0.08, 0.08);
    blobs.push({
      x: vertical ? cross : along,
      y: vertical ? along : cross,
      radiusX: rng.float(0.2, 0.31),
      radiusY: rng.float(0.18, 0.29),
      strength: rng.float(0.9, 1.08)
    });
  }
  for (let index = 0; index < 2; index += 1) {
    blobs.push({
      x: rng.float(-0.75, 0.75),
      y: rng.float(-0.75, 0.75),
      radiusX: rng.float(0.14, 0.22),
      radiusY: rng.float(0.14, 0.22),
      strength: rng.float(0.82, 0.96)
    });
  }
  return blobs;
}

function geographyElevation(
  style: WorldGenerationStyle,
  nx: number,
  ny: number,
  radial: number,
  falloff: number,
  blobs: IslandBlob[]
): { continentWeight: number; regionWeight: number; mountainWeight: number; base: number; waterCut: number } {
  if (style === "archipelago" || style === "islandChain") {
    let islandMask = 0;
    for (const blob of blobs) {
      const distance = Math.hypot((nx - blob.x) / blob.radiusX, (ny - blob.y) / blob.radiusY);
      islandMask = Math.max(islandMask, Math.max(0, 1 - distance) * blob.strength);
    }
    return {
      continentWeight: 0.34,
      regionWeight: 0.17,
      mountainWeight: 0.1,
      base: islandMask * 0.66 - 0.12,
      waterCut: Math.max(0, radial - 0.92) * 0.35
    };
  }
  if (style === "inlandSea") {
    const lake = Math.max(0, 1 - Math.hypot(nx * 1.12, ny * 0.88) / 0.46);
    return {
      continentWeight: 0.62,
      regionWeight: 0.24,
      mountainWeight: 0.13,
      base: 0.27,
      waterCut: falloff * 0.58 + lake * 0.52
    };
  }
  return {
    continentWeight: 0.62,
    regionWeight: 0.24,
    mountainWeight: 0.13,
    base: 0.26,
    waterCut: falloff * 0.64
  };
}

function carveSeaStraits(world: World): void {
  if (world.width < 256) return;
  const rng = new SeededRandom(`${world.seed}:straits`);
  const channels = 1;
  for (let channel = 0; channel < channels; channel += 1) {
    const vertical = channel % 2 === 0;
    const base = world.width * (channel === 0 ? rng.float(0.38, 0.62) : rng.float(0.3, 0.7));
    const amplitude = world.width * rng.float(0.045, 0.09);
    const phase = rng.float(0, Math.PI * 2);
    const width = Math.max(3, Math.floor(world.width / 90));
    const length = vertical ? world.height : world.width;
    let previousCenter = Math.round(base + Math.sin(phase) * amplitude);
    for (let step = 0; step < length; step += 1) {
      const progress = step / Math.max(1, length - 1);
      const broadMeander = Math.sin(progress * Math.PI * 2.2 + phase) * amplitude;
      const smallMeander = Math.sin(progress * Math.PI * 7.4 + phase * 0.63) * width * 0.75;
      const targetCenter = Math.round(base + broadMeander + smallMeander);
      const center =
        step === 0 ? targetCenter : previousCenter + clamp(targetCenter - previousCenter, -1, 1);
      previousCenter = center;
      const localWidth = width + (Math.sin(progress * Math.PI * 5 + phase) > 0.55 ? 1 : 0);
      for (let offset = -localWidth; offset <= localWidth; offset += 1) {
        const x = vertical ? center + offset : step;
        const y = vertical ? step : center + offset;
        const tile = getTile(world, x, y);
        if (!tile) continue;
        tile.type = Math.abs(offset) < Math.max(1, localWidth - 1) ? "deepWater" : "water";
        tile.elevation = Math.min(tile.elevation, Math.abs(offset) < localWidth - 1 ? 0.2 : 0.3);
        tile.resourceAmount = 0;
      }
    }
  }
}

function worldScale(size: number): { region: number; detail: number; moisture: number; mountains: number; lakes: number } {
  const large = size >= 512;
  return {
    region: large ? 7.2 : size >= 256 ? 6.4 : 5.4,
    detail: large ? 24 : size >= 256 ? 20 : 16,
    moisture: large ? 6.2 : 5.4,
    mountains: large ? 8.5 : 6.4,
    lakes: large ? 10.5 : 8.2
  };
}

function elevationBand(continent: number, region: number): number {
  return continent * 0.72 + region * 0.28;
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

function addMountainRanges(world: World, seedHash: number): void {
  for (const tile of world.tiles) {
    if (tile.type === "water" || tile.type === "deepWater") continue;
    const u = tile.x / Math.max(1, world.width - 1);
    const v = tile.y / Math.max(1, world.height - 1);
    const ridge = fbmNoise2D(u * 9.5 + 40, v * 9.5 - 11, seedHash + 1441, 4);
    if (ridge > 0.78 && tile.elevation > 0.58) {
      tile.type = ridge > 0.86 ? "mountain" : "rock";
      tile.resourceAmount = tile.type === "rock" ? Math.max(tile.resourceAmount, 3) : 0;
    }
  }
}

function carveRivers(world: World, seedHash: number): void {
  const rng = new SeededRandom(`${world.seed}:rivers`);
  const riverCount = world.width >= 512 ? 8 : world.width >= 256 ? 5 : 3;
  const candidates = world.tiles
    .filter((tile) => tile.elevation > 0.58 && tile.type !== "water" && tile.type !== "deepWater")
    .sort((a, b) => b.elevation - a.elevation)
    .slice(0, Math.max(60, riverCount * 20));
  for (let index = 0; index < riverCount && candidates.length > 0; index += 1) {
    const start = rng.pick(candidates);
    carveRiverFrom(world, start, seedHash + index * 53);
  }
}

function carveRiverFrom(world: World, start: Point, seed: number): void {
  let current = { x: start.x, y: start.y };
  const visited = new Set<string>();
  const maxLength = Math.floor(world.width * 1.4);
  for (let step = 0; step < maxLength; step += 1) {
    const tile = getTile(world, current.x, current.y);
    if (!tile || visited.has(tileKey(current.x, current.y))) break;
    visited.add(tileKey(current.x, current.y));
    if (tile.type === "deepWater") break;
    if (tile.type !== "mountain") {
      tile.type = step < 4 ? "rock" : "water";
      tile.resourceAmount = 0;
    }
    if (isWater(tile.type) && step > 12 && touchesExistingWater(world, current)) break;

    const neighbors = neighbors4(current)
      .map((point) => ({ point, tile: getTile(world, point.x, point.y) }))
      .filter((item): item is { point: Point; tile: Tile } => !!item.tile);
    const next = neighbors
      .map((item) => {
        const flowNoise = hash2D(item.point.x, item.point.y, seed) * 0.08;
        const edgePull = Math.hypot(item.point.x - world.width / 2, item.point.y - world.height / 2) / Math.max(world.width, world.height);
        return { point: item.point, score: item.tile.elevation - edgePull * 0.22 + flowNoise };
      })
      .sort((a, b) => a.score - b.score)[0]?.point;
    if (!next) break;
    current = next;
  }
}

function touchesExistingWater(world: World, point: Point): boolean {
  return neighbors4(point).some((neighbor) => {
    const tile = getTile(world, neighbor.x, neighbor.y);
    return tile ? tile.type === "water" || tile.type === "deepWater" : true;
  });
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

function findLandAreas(world: World): number[] {
  const visited = new Set<string>();
  const areas: number[] = [];

  for (const tile of world.tiles) {
    if (visited.has(tileKey(tile.x, tile.y)) || !isLand(tile.type) || tile.type === "mountain") continue;
    let area = 0;
    const queue: Point[] = [{ x: tile.x, y: tile.y }];
    let cursor = 0;
    visited.add(tileKey(tile.x, tile.y));

    while (cursor < queue.length) {
      const current = queue[cursor];
      cursor += 1;
      area += 1;
      for (const neighbor of neighbors4(current)) {
        const key = tileKey(neighbor.x, neighbor.y);
        const other = getTile(world, neighbor.x, neighbor.y);
        if (!other || visited.has(key) || !isLand(other.type) || other.type === "mountain") continue;
        visited.add(key);
        queue.push(neighbor);
      }
    }

    areas.push(area);
  }

  return areas.sort((a, b) => b - a);
}

function generateWorldName(rng: SeededRandom): string {
  return `${rng.pick(NAME_PREFIXES)}${rng.pick(NAME_SUFFIXES)}`;
}
