import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { igniteTile, updateFire } from "../src/simulation/FireSystem";
import { getTile } from "../src/world/World";

describe("FireSystem", () => {
  it("ignites burnable land and consumes fuel", () => {
    const state = createNewGameState("fire", 64);
    const point = state.world.spawn;
    const tile = getTile(state.world, point.x + 4, point.y + 4)!;
    tile.type = "forest";
    tile.resourceAmount = 3;
    expect(igniteTile(state, tile.x, tile.y)).toBe(true);
    const before = state.fires[0].fuel;
    updateFire(state, 1);
    expect(state.fires[0].fuel).toBeLessThan(before);
  });
});
