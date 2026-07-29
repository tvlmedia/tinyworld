import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { Settlement } from "../src/entities/Civilization";
import { chooseNextBuilding, desiredHousingCapacity, updateSettlementPlanner } from "../src/simulation/SettlementPlanner";
import { Simulation } from "../src/simulation/Simulation";
import { getTile } from "../src/world/World";

describe("settlement growth", () => {
  it("keeps planning homes after three upgraded houses reach exactly 21 beds", () => {
    const state = createNewGameState("twenty-one-bed-regression", 64);
    const settlement = state.settlements[0];
    const civilization = state.civilizations[0];
    settlement.population = 21;
    settlement.abstractPopulation = 16;
    settlement.housingCapacity = 21;

    const essentialTypes = ["mine", "farm", "woodcutter", "well", "workshop"] as const;
    for (const [index, type] of essentialTypes.entries()) {
      const building = createBuildingAt(
        state,
        type,
        state.world.spawn.x + 9 + index * 4,
        state.world.spawn.y + 9,
        true
      );
      building.settlementId = settlement.id;
      building.civilizationId = civilization.id;
    }
    for (let index = 0; index < 3; index += 1) {
      const house = createBuildingAt(state, "house", state.world.spawn.x - 12 + index * 4, state.world.spawn.y + 12, true);
      house.settlementId = settlement.id;
      house.civilizationId = civilization.id;
      house.capacity = 7;
      house.upgradeLevel = 2;
    }

    expect(desiredHousingCapacity(settlement.population)).toBeGreaterThan(21);
    expect(chooseNextBuilding(state, settlement)).toBe("house");
  });

  it("starts projects in several settlements during the same planner cycle", () => {
    const state = createNewGameState("parallel-village-projects", 128);
    for (const tile of state.world.tiles) {
      tile.type = "grass";
      tile.fertility = 0.75;
      tile.resourceAmount = 3;
      tile.occupiedByBuildingId = undefined;
    }
    for (const building of state.buildings) {
      for (let y = building.y; y < building.y + building.height; y += 1) {
        for (let x = building.x; x < building.x + building.width; x += 1) {
          const tile = getTile(state.world, x, y);
          if (tile) tile.occupiedByBuildingId = building.id;
        }
      }
    }

    const origin = state.settlements[0];
    const civilization = state.civilizations[0];
    const centers = [
      { x: 24, y: 24 },
      { x: 104, y: 24 },
      { x: 24, y: 104 },
      { x: 104, y: 104 },
      { x: 64, y: 104 }
    ];
    for (let index = 0; index < centers.length; index += 1) {
      const settlement: Settlement = {
        ...origin,
        id: `settlement-growth-${index}`,
        name: `Growth ${index}`,
        centerX: centers[index].x,
        centerY: centers[index].y,
        population: 21,
        abstractPopulation: 21,
        housingCapacity: 21,
        buildingIds: [],
        residentIds: [],
        connectedSettlementIds: [],
        stockpile: { ...origin.stockpile }
      };
      state.settlements.push(settlement);
      civilization.settlementIds.push(settlement.id);
    }

    state.plannerTimer = 0;
    updateSettlementPlanner(state, 1);

    const settlementsWithNewProjects = new Set(
      state.buildings
        .filter((building) => building.status !== "complete" && building.settlementId)
        .map((building) => building.settlementId)
    );
    expect(settlementsWithNewProjects.size).toBeGreaterThanOrEqual(2);
  });

  it("lets at least one satellite settlement grow beyond village size", () => {
    const state = createNewGameState("large-satellite-settlements", 128);
    const simulation = new Simulation();
    for (let second = 0; second < 50 * 60; second += 1) simulation.update(state, 1);

    const capitalId = state.civilizations[0].capitalSettlementId;
    const satellites = state.settlements.filter(
      (settlement) => settlement.civilizationId === state.civilizations[0].id && settlement.id !== capitalId
    );
    expect(satellites.length).toBeGreaterThan(0);
    expect(Math.max(...satellites.map((settlement) => settlement.population))).toBeGreaterThan(28);
  }, 15_000);
});
