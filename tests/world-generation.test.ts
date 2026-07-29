import { describe, expect, it } from "vitest";
import { generateWorld, validateWorld } from "../src/world/WorldGenerator";
import { countLandComponents } from "../src/world/Maritime";

describe("WorldGenerator", () => {
  it("generates deterministic tile types for a fixed seed", () => {
    const first = generateWorld("fixed-seed", 64);
    const second = generateWorld("fixed-seed", 64);
    expect(first.tiles.map((tile) => tile.type).join("|")).toBe(second.tiles.map((tile) => tile.type).join("|"));
    expect(first.spawn).toEqual(second.spawn);
  });

  it("creates a playable land percentage", () => {
    const world = generateWorld("playable-world", 64);
    const validation = validateWorld(world);
    expect(validation.playable).toBe(true);
    expect(validation.landTiles / (world.width * world.height)).toBeGreaterThan(0.22);
    expect(validation.forestTiles).toBeGreaterThan(100);
  });

  it.each([128, 256, 512])("creates a playable %s world", (size) => {
    const world = generateWorld(`playable-${size}`, size);
    const validation = validateWorld(world);
    expect(world.width).toBe(size);
    expect(world.height).toBe(size);
    expect(world.tiles).toHaveLength(size * size);
    expect(validation.playable).toBe(true);
    expect(validation.largestLandArea).toBeGreaterThan(validation.landTiles * (size >= 256 ? 0.25 : 0.5));
    if (size >= 256) expect(countLandComponents(world, Math.floor(size * size * 0.015))).toBeGreaterThanOrEqual(2);
  });

  it("keeps generation deterministic per seed and world size", () => {
    const small = generateWorld("same-seed", 128);
    const large = generateWorld("same-seed", 512);
    const largeAgain = generateWorld("same-seed", 512);
    expect(large.tiles.map((tile) => tile.type).join("|")).toBe(largeAgain.tiles.map((tile) => tile.type).join("|"));
    expect(large.spawn).toEqual(largeAgain.spawn);
    expect(small.tiles.length).not.toBe(large.tiles.length);
    expect(large.seed).toBe("same-seed");
  });

  it("varies geography between continents, island chains and archipelagos", () => {
    const worlds = Array.from({ length: 24 }, (_, index) => generateWorld(`World-geography-${index}`, 128));
    const styles = new Set(worlds.map((world) => world.generationStyle));
    expect(styles.size).toBeGreaterThanOrEqual(3);
    expect(styles.has("archipelago")).toBe(true);
    expect(styles.has("islandChain")).toBe(true);

    for (const world of worlds.filter(
      (candidate) => candidate.generationStyle === "archipelago" || candidate.generationStyle === "islandChain"
    )) {
      const validation = validateWorld(world);
      expect(validation.majorLandComponents).toBeGreaterThanOrEqual(world.generationStyle === "archipelago" ? 3 : 2);
    }
  }, 15_000);
});
