import { describe, expect, it } from "vitest";
import { generateWorld, validateWorld } from "../src/world/WorldGenerator";

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
    expect(validation.largestLandArea).toBeGreaterThan(validation.landTiles * 0.55);
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
});
