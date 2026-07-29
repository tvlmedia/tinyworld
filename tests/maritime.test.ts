import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { areLandConnected, countLandComponents, hasHarbor } from "../src/world/Maritime";
import { getTile } from "../src/world/World";
import { generateWorld } from "../src/world/WorldGenerator";

describe("islands and shipping", () => {
  it("generates multiple substantial islands on large worlds", () => {
    const world = generateWorld("archipelago", 256);
    expect(countLandComponents(world, 900)).toBeGreaterThanOrEqual(2);
  });

  it("requires a harbor to mark a settlement as sea-ready", () => {
    const state = createNewGameState("harbor-access", 64);
    const settlement = state.settlements[0];
    const civilization = state.civilizations[0];
    const harbor = createBuildingAt(state, "harbor", state.world.spawn.x + 8, state.world.spawn.y + 6, true);
    harbor.settlementId = settlement.id;
    harbor.civilizationId = civilization.id;
    expect(hasHarbor(state, settlement.id)).toBe(true);
  });

  it("distinguishes islands separated by a sea channel", () => {
    const state = createNewGameState("sea-channel", 64);
    for (const tile of state.world.tiles) {
      tile.type = "grass";
      tile.occupiedByBuildingId = undefined;
    }
    for (let y = 0; y < state.world.height; y += 1) {
      const tile = getTile(state.world, 32, y);
      if (tile) tile.type = "deepWater";
    }
    expect(areLandConnected(state.world, { x: 20, y: 30 }, { x: 25, y: 30 })).toBe(true);
    expect(areLandConnected(state.world, { x: 20, y: 30 }, { x: 44, y: 30 })).toBe(false);
  });
});
