import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { Simulation } from "../src/simulation/Simulation";

describe("long simulation stability", () => {
  it("runs twenty minutes of simulation without stalling", () => {
    const state = createNewGameState("twenty-minute-check", 64);
    const simulation = new Simulation();
    for (let second = 0; second < 20 * 60; second += 1) {
      simulation.update(state, 1);
    }
    expect(state.villagers.length).toBeGreaterThan(0);
    expect(Number.isFinite(state.resources.food)).toBe(true);
    expect(Number.isFinite(state.resources.wood)).toBe(true);
    expect(state.time.day).toBeGreaterThanOrEqual(1);
  });
});
