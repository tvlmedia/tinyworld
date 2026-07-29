import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { Simulation } from "../src/simulation/Simulation";

describe("civilization growth", () => {
  it("develops beyond the initial camp during autonomous simulation", () => {
    const state = createNewGameState("civilization-growth", 64);
    const simulation = new Simulation();

    for (let second = 0; second < 25 * 60; second += 1) {
      simulation.update(state, 1);
    }

    const completedBuildings = state.buildings.filter((building) => building.status === "complete");
    const completedTypes = new Set(completedBuildings.map((building) => building.type));
    expect(completedBuildings.length).toBeGreaterThanOrEqual(10);
    expect(completedTypes.has("mine")).toBe(true);
    expect(completedTypes.has("workshop")).toBe(true);
    expect(completedTypes.has("market")).toBe(true);
    expect(completedTypes.has("school")).toBe(true);
    expect(state.villagers.length).toBeGreaterThanOrEqual(7);
    expect(state.civilization.level).toBeGreaterThanOrEqual(2);
    expect(state.civilization.nextGoal).not.toBe("bouw het eerste huis");
  });
});
