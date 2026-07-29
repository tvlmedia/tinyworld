import { describe, expect, it } from "vitest";
import { updateVillager } from "../src/ai/VillagerBrain";
import { simulationSubsteps } from "../src/app/Config";
import { createNewGameState } from "../src/app/GameState";

describe("performance safeguards", () => {
  it("keeps 32x simulation work bounded per fixed frame", () => {
    expect(simulationSubsteps(0.1, 1)).toBe(1);
    expect(simulationSubsteps(0.1, 16)).toBe(2);
    expect(simulationSubsteps(0.1, 32)).toBe(4);
  });

  it("lets coarse simulation steps consume multiple path segments", () => {
    const state = createNewGameState("coarse-movement", 64);
    const villager = state.villagers[0];
    villager.x = 10.5;
    villager.y = 10.5;
    villager.targetX = 13.5;
    villager.targetY = 10.5;
    villager.state = "wander";
    villager.path = [
      { x: 11, y: 10 },
      { x: 12, y: 10 },
      { x: 13, y: 10 }
    ];

    updateVillager(villager, state, 1);

    expect(villager.x).toBeGreaterThan(11.5);
    expect(villager.path.length).toBeLessThan(3);
  });
});
