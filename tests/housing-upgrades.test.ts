import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { updateHousingUpgrades } from "../src/simulation/HousingUpgradeSystem";
import { Simulation } from "../src/simulation/Simulation";

describe("housing upgrades", () => {
  it("invests earned resources to increase house capacity", () => {
    const state = createNewGameState("housing-upgrade", 64);
    const settlement = state.settlements[0];
    const civilization = state.civilizations[0];
    const house = createBuildingAt(state, "house", state.world.spawn.x + 8, state.world.spawn.y + 6, true);
    house.settlementId = settlement.id;
    house.civilizationId = civilization.id;
    settlement.population = 12;
    settlement.abstractPopulation = 7;
    civilization.unlockedTechnologyIds.push("woodworking");
    state.resources.wood = 60;
    state.resources.stone = 20;
    state.housingUpgradeTimer = 0;

    updateHousingUpgrades(state, 1);

    expect(house.upgradeLevel).toBe(2);
    expect(house.capacity).toBe(7);
    expect(state.resources.wood).toBe(50);
    expect(state.resources.stone).toBe(18);
  });

  it("does not upgrade before population and technology requirements are met", () => {
    const state = createNewGameState("housing-gated", 64);
    const settlement = state.settlements[0];
    const house = createBuildingAt(state, "house", state.world.spawn.x + 8, state.world.spawn.y + 6, true);
    house.settlementId = settlement.id;
    house.civilizationId = state.civilizations[0].id;
    state.resources.wood = 100;
    state.resources.stone = 100;
    state.housingUpgradeTimer = 0;

    updateHousingUpgrades(state, 1);

    expect(house.upgradeLevel).toBe(1);
    expect(house.capacity).toBe(4);
  });

  it("lets a developed civilization grow well beyond a small village", () => {
    const state = createNewGameState("large-population", 128);
    const simulation = new Simulation();
    for (let second = 0; second < 45 * 60; second += 1) simulation.update(state, 1);
    const population = state.settlements.reduce((sum, settlement) => sum + settlement.population, 0);
    const upgradedHomes = state.buildings.filter((building) => building.type === "house" && (building.upgradeLevel ?? 1) > 1);
    expect(population).toBeGreaterThan(80);
    expect(upgradedHomes.length).toBeGreaterThan(0);
  });
});
