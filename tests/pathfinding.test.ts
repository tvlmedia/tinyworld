import { describe, expect, it } from "vitest";
import { Pathfinder } from "../src/ai/Pathfinding";
import { Tile } from "../src/world/Tile";
import { World } from "../src/world/World";

function worldFrom(types: string[]): World {
  const width = types[0].length;
  const height = types.length;
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const char = types[y][x];
      tiles.push({
        x,
        y,
        type: char === "w" ? "water" : char === "m" ? "mountain" : char === "r" ? "road" : "grass",
        elevation: 0.5,
        moisture: 0.5,
        fertility: 0.5,
        temperature: 0.5,
        resourceAmount: 0
      });
    }
  }
  return { seed: "test", name: "Test", width, height, tiles, spawn: { x: 0, y: 0 }, version: 0 };
}

describe("Pathfinder", () => {
  it("avoids water and mountains", () => {
    const world = worldFrom(["ggggg", "gwwwg", "gggmg", "ggggg"]);
    const path = new Pathfinder().findPath(world, { x: 0, y: 0 }, { x: 4, y: 3 }).path;
    expect(path.length).toBeGreaterThan(0);
    expect(path.some((point) => world.tiles[point.y * world.width + point.x].type === "water")).toBe(false);
    expect(path.some((point) => world.tiles[point.y * world.width + point.x].type === "mountain")).toBe(false);
  });

  it("returns no path for disconnected land", () => {
    const world = worldFrom(["gwwwg", "wwwww", "gwwwg"]);
    expect(new Pathfinder().findPath(world, { x: 0, y: 0 }, { x: 4, y: 0 }).path).toEqual([]);
  });
});
