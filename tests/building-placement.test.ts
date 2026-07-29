import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { findBuildingSpot, isValidBuildingSpot } from "../src/simulation/SettlementPlanner";

describe("SettlementPlanner", () => {
  it("finds valid space for a house around the center", () => {
    const state = createNewGameState("placement", 64);
    const spot = findBuildingSpot(state, "house");
    expect(spot).toBeDefined();
    expect(isValidBuildingSpot(state, spot!.x, spot!.y, "house")).toBe(true);
  });
});
