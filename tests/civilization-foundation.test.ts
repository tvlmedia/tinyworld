import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { updateCivilization } from "../src/simulation/CivilizationSystem";
import { SaveManager } from "../src/persistence/SaveManager";
import { serializeGame } from "../src/persistence/Serialization";

describe("civilization foundation", () => {
  it("creates the first civilization and settlement from a new world", () => {
    const state = createNewGameState("first-civilization", 64);
    expect(state.civilizations).toHaveLength(1);
    expect(state.settlements).toHaveLength(1);
    expect(state.civilizations[0].capitalSettlementId).toBe(state.settlements[0].id);
    expect(state.settlements[0].buildingIds.length).toBeGreaterThan(0);
    expect(state.villagers.every((villager) => villager.civilizationId === state.civilizations[0].id)).toBe(true);
  });

  it("assigns territory around the capital settlement", () => {
    const state = createNewGameState("territory", 64);
    updateCivilization(state, 1);
    const ownedTiles = state.territory.ownerByTile.filter((owner) => owner === state.civilizations[0].id).length;
    expect(ownedTiles).toBeGreaterThan(20);
  });

  it("keeps restored legacy saves playable by bootstrapping civilization data", () => {
    const state = createNewGameState("legacy-bootstrap", 64);
    createBuildingAt(state, "house", state.world.spawn.x + 7, state.world.spawn.y + 4, true);
    const save = serializeGame(state);
    const legacy = {
      ...save,
      version: 2,
      civilizations: undefined,
      settlements: undefined,
      territory: undefined,
      historicEvents: undefined
    };
    const restored = new SaveManager().restoreState(legacy);
    expect(restored.civilizations).toHaveLength(1);
    expect(restored.settlements).toHaveLength(1);
    expect(restored.buildings.every((building) => building.civilizationId === restored.civilizations[0].id)).toBe(true);
  });
});
