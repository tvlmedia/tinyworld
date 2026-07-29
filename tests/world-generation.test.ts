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
});
