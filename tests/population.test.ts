import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { homelessCount, updateHousing } from "../src/simulation/HousingSystem";
import { updatePopulation } from "../src/simulation/PopulationSystem";

describe("PopulationSystem", () => {
  it("adds a villager when food, happiness, and beds are sufficient", () => {
    const state = createNewGameState("population", 64);
    createBuildingAt(state, "house", state.world.spawn.x + 7, state.world.spawn.y + 4, true);
    createBuildingAt(state, "house", state.world.spawn.x + 11, state.world.spawn.y + 4, true);
    state.resources.food = 120;
    updateHousing(state);
    expect(homelessCount(state)).toBe(0);
    state.populationTimer = 100;
    const before = state.villagers.length;
    updatePopulation(state, 1);
    expect(state.villagers.length).toBe(before + 1);
    expect(state.villagers.at(-1)?.homeId).toBeTruthy();
  });

  it("does not add a villager without a free house bed", () => {
    const state = createNewGameState("population-no-bed", 64);
    createBuildingAt(state, "house", state.world.spawn.x + 7, state.world.spawn.y + 4, true);
    state.resources.food = 120;
    state.populationTimer = 100;
    const before = state.villagers.length;
    updatePopulation(state, 1);
    expect(state.villagers.length).toBe(before);
  });
});
