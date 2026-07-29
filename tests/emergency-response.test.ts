import { describe, expect, it } from "vitest";
import { updateVillager } from "../src/ai/VillagerBrain";
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

  it("fetches water and extinguishes a fire inside a multi-tile building", () => {
    const state = createNewGameState("fire-brigade", 64);
    const settlement = state.settlements[0];
    const civilization = state.civilizations[0];
    const house = createBuildingAt(state, "house", state.world.spawn.x + 7, state.world.spawn.y + 5, true);
    const well = createBuildingAt(state, "well", state.world.spawn.x + 3, state.world.spawn.y + 5, true);
    for (const building of [house, well]) {
      building.settlementId = settlement.id;
      building.civilizationId = civilization.id;
    }

    igniteTile(state, house.x + 1, house.y + 1, 0.9);
    updateEmergencyResponse(state);
    let carriedWater = false;
    let extinguishedAtBuilding = false;
    for (let tick = 0; tick < 320 && state.fires.length > 0; tick += 1) {
      for (const villager of state.villagers) {
        updateVillager(villager, state, 0.25);
        carriedWater ||= (villager.carryingWater ?? 0) > 0;
        extinguishedAtBuilding ||= villager.state === "extinguishFire";
      }
      updateFire(state, 0.25);
      updateEmergencyResponse(state, 0.25);
    }

    expect(carriedWater).toBe(true);
    expect(extinguishedAtBuilding).toBe(true);
    const buildingFire = state.fires.find((fire) => fire.x === house.x + 1 && fire.y === house.y + 1);
    expect(buildingFire?.intensity ?? 0).toBeLessThan(0.9);
    expect(house.status).toBe("complete");
  });

  it("responds to spreading fire on the edge of a settlement", () => {
    const state = createNewGameState("fire-brigade", 64);
    const settlement = state.settlements[0];
    const civilization = state.civilizations[0];
    const house = createBuildingAt(state, "house", state.world.spawn.x + 7, state.world.spawn.y + 5, true);
    const well = createBuildingAt(state, "well", state.world.spawn.x + 3, state.world.spawn.y + 5, true);
    for (const building of [house, well]) {
      building.settlementId = settlement.id;
      building.civilizationId = civilization.id;
    }

    const edgeFire = { x: house.x + house.width + 1, y: house.y + 1 };
    expect(igniteTile(state, edgeFire.x, edgeFire.y, 0.7)).toBe(true);
    updateEmergencyResponse(state);

    expect(
      state.villagers.some(
        (villager) => villager.emergencyFire?.x === edgeFire.x && villager.emergencyFire?.y === edgeFire.y
      )
    ).toBe(true);
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
