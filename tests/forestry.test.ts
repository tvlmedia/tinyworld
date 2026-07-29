import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { chooseNextBuilding } from "../src/simulation/SettlementPlanner";
import { Simulation } from "../src/simulation/Simulation";
import { getTile } from "../src/world/World";

describe("managed forestry", () => {
  it("plans a forestry business for a larger wood-starved settlement", () => {
    const state = createNewGameState("forestry-planning", 64);
    const settlement = state.settlements[0];
    const civilization = state.civilizations[0];
    civilization.unlockedTechnologyIds.push("woodworking", "markets", "writing");
    settlement.abstractPopulation = 20;
    settlement.population = 20;
    state.resources.wood = 0;

    for (let index = 0; index < 6; index += 1) {
      const house = createBuildingAt(state, "house", state.world.spawn.x - 20 + index * 4, state.world.spawn.y + 16, true);
      house.settlementId = settlement.id;
      house.civilizationId = civilization.id;
    }
    for (const type of ["mine", "farm", "farm", "woodcutter", "well", "workshop", "market", "school"] as const) {
      const building = createBuildingAt(state, type, state.world.spawn.x - 20, state.world.spawn.y - 18, true);
      building.settlementId = settlement.id;
      building.civilizationId = civilization.id;
    }

    expect(chooseNextBuilding(state, settlement)).toBe("forestry");
  });

  it("only tends managed forest when woodcutters are available", () => {
    const state = createNewGameState("forestry-workers", 64);
    const forestry = createBuildingAt(state, "forestry", state.world.spawn.x + 9, state.world.spawn.y + 7, true);
    forestry.settlementId = state.settlements[0].id;
    const tile = getTile(state.world, forestry.x - 1, forestry.y);
    expect(tile).toBeDefined();
    if (!tile) return;
    tile.type = "forest";
    tile.resourceAmount = 0;
    state.villagers = [];

    const simulation = new Simulation();
    for (let second = 0; second < 30; second += 1) simulation.update(state, 1);

    expect(tile.resourceAmount).toBe(0);
  });
});
