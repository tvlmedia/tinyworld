import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { Civilization, Settlement } from "../src/entities/Civilization";
import { updateCivilization } from "../src/simulation/CivilizationSystem";

describe("settlement lifecycle", () => {
  it("removes an empty settlement while leaving completed buildings abandoned", () => {
    const state = createNewGameState("abandoned-village", 64);
    const settlement = state.settlements[0];
    const unfinished = createBuildingAt(state, "house", state.world.spawn.x + 8, state.world.spawn.y + 8);
    unfinished.settlementId = settlement.id;
    unfinished.civilizationId = settlement.civilizationId;
    state.villagers = [];
    settlement.abstractPopulation = 0;

    updateCivilization(state, 1);
    updateCivilization(state, 1);

    expect(state.settlements).toHaveLength(0);
    expect(state.buildings.some((building) => building.id === unfinished.id)).toBe(false);
    expect(state.buildings.length).toBeGreaterThan(0);
    expect(state.buildings.every((building) => building.civilizationId === undefined)).toBe(true);
  });

  it("lets another civilization claim completed buildings inside its territory", () => {
    const state = createNewGameState("claimed-ruins", 64);
    const abandoned = state.settlements[0];
    const oldBuildingIds = state.buildings.map((building) => building.id);
    const originalCivilization = state.civilizations[0];
    const claimantId = "civilization-claimant";
    const claimantSettlementId = "settlement-claimant";
    const claimantSettlement: Settlement = {
      ...abandoned,
      id: claimantSettlementId,
      civilizationId: claimantId,
      name: "Nieuwdam",
      centerX: abandoned.centerX + 7,
      centerY: abandoned.centerY,
      population: 6,
      abstractPopulation: 6,
      buildingIds: [],
      residentIds: [],
      connectedSettlementIds: []
    };
    const claimant: Civilization = {
      ...originalCivilization,
      id: claimantId,
      name: "Nieuw volk",
      colorIndex: originalCivilization.colorIndex + 1,
      capitalSettlementId: claimantSettlementId,
      settlementIds: [claimantSettlementId],
      population: 6
    };
    state.civilizations.push(claimant);
    state.settlements.push(claimantSettlement);
    state.villagers = [];
    abandoned.abstractPopulation = 0;

    updateCivilization(state, 1);

    expect(state.settlements.some((settlement) => settlement.id === abandoned.id)).toBe(false);
    expect(
      state.buildings
        .filter((building) => oldBuildingIds.includes(building.id))
        .every((building) => building.civilizationId === claimantId && building.settlementId === claimantSettlementId)
    ).toBe(true);
  });
});
