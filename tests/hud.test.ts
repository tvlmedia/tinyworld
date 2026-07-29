import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { hudSummary } from "../src/ui/HUD";

describe("HUD summary", () => {
  it("shows total inhabitants separately from visible agents", () => {
    const state = createNewGameState("hud-population", 128);
    state.settlements[0].population = 44;
    state.settlements[0].abstractPopulation = 39;
    state.settlements[0].housingCapacity = 56;
    state.civilizations[0].population = 44;

    const html = hudSummary(state);

    expect(html).toContain("Inwoners <strong>44</strong>");
    expect(html).toContain("Actief <strong>5</strong>");
    expect(html).toContain("Bedden <strong>44/56</strong>");
    expect(html).not.toContain("Bewoners <strong>5</strong>");
  });
});
