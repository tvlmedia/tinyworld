import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { Simulation } from "../src/simulation/Simulation";

describe("earned resource economy", () => {
  it("does not add stored resources from production buildings without villager work", () => {
    const state = createNewGameState("earned-economy", 64);
    state.villagers = [];
    state.resources = { food: 0, wood: 0, stone: 0 };
    createBuildingAt(state, "farm", state.world.spawn.x + 8, state.world.spawn.y + 5, true);
    createBuildingAt(state, "woodcutter", state.world.spawn.x + 13, state.world.spawn.y + 5, true);
    createBuildingAt(state, "mine", state.world.spawn.x + 18, state.world.spawn.y + 5, true);
    createBuildingAt(state, "workshop", state.world.spawn.x + 23, state.world.spawn.y + 5, true);
    createBuildingAt(state, "market", state.world.spawn.x + 29, state.world.spawn.y + 5, true);

    const simulation = new Simulation();
    for (let second = 0; second < 180; second += 1) {
      simulation.update(state, 1);
    }

    expect(state.resources).toEqual({ food: 0, wood: 0, stone: 0 });
  });
});
