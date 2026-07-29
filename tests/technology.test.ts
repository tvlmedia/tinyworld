import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { economyMultiplier, isBuildingUnlocked, isResearchAvailable, chooseResearch, updateTechnology } from "../src/simulation/TechnologySystem";

describe("technology system", () => {
  it("respects technology prerequisites", () => {
    const state = createNewGameState("tech-prereq", 64);
    const civ = state.civilizations[0];
    expect(isResearchAvailable(civ, "agriculture")).toBe(true);
    expect(isResearchAvailable(civ, "markets")).toBe(false);
  });

  it("prioritizes agriculture during food insecurity", () => {
    const state = createNewGameState("tech-choice", 64);
    const civ = state.civilizations[0];
    civ.foodSecurity = 20;
    civ.traits = ["agricultural"];
    expect(chooseResearch(state, civ)?.id).toBe("agriculture");
  });

  it("unlocks measurable economy effects", () => {
    const state = createNewGameState("tech-unlock", 64);
    const civ = state.civilizations[0];
    civ.currentResearchId = "agriculture";
    civ.storedResearch = 100;
    state.civilizationTimers.research = 0;
    updateTechnology(state, 1);
    expect(civ.unlockedTechnologyIds).toContain("agriculture");
    expect(economyMultiplier(civ, "food")).toBeGreaterThan(1);
  });

  it("gates advanced buildings behind research", () => {
    const state = createNewGameState("tech-buildings", 64);
    const civ = state.civilizations[0];
    expect(isBuildingUnlocked(state, civ.id, "market")).toBe(false);
    civ.unlockedTechnologyIds.push("roads", "agriculture", "markets");
    expect(isBuildingUnlocked(state, civ.id, "market")).toBe(true);
  });
});
