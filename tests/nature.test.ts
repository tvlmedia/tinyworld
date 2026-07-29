import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { updateNature } from "../src/simulation/NatureSystem";
import { getTile, tileIndex } from "../src/world/World";

describe("NatureSystem", () => {
  it("recovers burned ground into living terrain over time", () => {
    const state = createNewGameState("burned-recovery", 64);
    const tile = getTile(state.world, state.world.spawn.x + 6, state.world.spawn.y + 3)!;
    for (let y = tile.y - 2; y <= tile.y + 2; y += 1) {
      for (let x = tile.x - 2; x <= tile.x + 2; x += 1) {
        const nearby = getTile(state.world, x, y);
        if (nearby && nearby.type === "forest") nearby.type = "grass";
      }
    }
    tile.type = "burned";
    tile.resourceAmount = 4.2;
    tile.fertility = 0.72;
    tile.moisture = 0.68;
    state.burnedRecoveryCursor = tileIndex(state.world, tile.x, tile.y) - 1;
    const versionBefore = state.world.version;

    updateNature(state, 1);

    expect(tile.type).toBe("grass");
    expect(tile.resourceAmount).toBeGreaterThan(0);
    expect(state.world.version).toBeGreaterThan(versionBefore);
  });

  it("lets forest return when burned ground recovers beside trees", () => {
    const state = createNewGameState("burned-forest-recovery", 64);
    const tile = getTile(state.world, state.world.spawn.x + 5, state.world.spawn.y + 5)!;
    const neighbor = getTile(state.world, tile.x + 1, tile.y)!;
    tile.type = "burned";
    tile.resourceAmount = 4.2;
    tile.fertility = 0.72;
    tile.moisture = 0.68;
    neighbor.type = "forest";
    neighbor.resourceAmount = 4;
    state.burnedRecoveryCursor = tileIndex(state.world, tile.x, tile.y) - 1;

    updateNature(state, 1);

    expect(tile.type).toBe("forest");
    expect(tile.resourceAmount).toBe(1);
  });
});
