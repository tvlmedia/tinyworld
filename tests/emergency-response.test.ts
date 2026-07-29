import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { Simulation } from "../src/simulation/Simulation";
import { updateEmergencyResponse } from "../src/simulation/EmergencyResponseSystem";
import { igniteTile, updateFire } from "../src/simulation/FireSystem";

describe("emergency response", () => {
  it("raises an alarm and assigns civilians to fetch water", () => {
    const state = createNewGameState("fire-brigade", 64);
    const settlement = state.settlements[0];
    const civilization = state.civilizations[0];
    const house = createBuildingAt(state, "house", state.world.spawn.x + 7, state.world.spawn.y + 5, true);
    const well = createBuildingAt(state, "well", state.world.spawn.x + 3, state.world.spawn.y + 5, true);
    for (const building of [house, well]) {
      building.settlementId = settlement.id;
      building.civilizationId = civilization.id;
    }

    igniteTile(state, house.x + 1, house.y + 1, 0.65);
    updateEmergencyResponse(state);

    const responders = state.villagers.filter((villager) => !!villager.emergencyFire);
    expect(responders.length).toBeGreaterThanOrEqual(2);
    expect(responders.every((villager) => villager.state === "walkToWater" || villager.state === "collectWater")).toBe(true);
    expect(state.events.some((event) => event.text.includes("Brandalarm"))).toBe(true);
  });

  it("turns a destroyed building into a salvaged rebuild project", () => {
    const state = createNewGameState("fire-rebuild", 64);
    const settlement = state.settlements[0];
    const civilization = state.civilizations[0];
    const storage = createBuildingAt(state, "storage", state.world.spawn.x + 12, state.world.spawn.y + 10, true);
    storage.settlementId = settlement.id;
    storage.civilizationId = civilization.id;
    igniteTile(state, storage.x + 1, storage.y, 1.5);

    for (let tick = 0; tick < 30 && storage.status === "complete"; tick += 1) updateFire(state, 1);

    expect(storage.status).toBe("planned");
    expect(storage.materialsDelivered.wood).toBeGreaterThan(0);
    expect(state.buildings.some((building) => building.id === storage.id)).toBe(true);

    state.fires = [];
    state.resources.wood = 200;
    state.resources.stone = 100;
    state.resources.food = 200;
    const simulation = new Simulation();
    for (let tick = 0; tick < 180 && storage.status !== "complete"; tick += 1) simulation.update(state, 1);

    expect(storage.status).toBe("complete");
  });
});
