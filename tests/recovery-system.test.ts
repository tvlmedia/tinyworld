import { describe, expect, it } from "vitest";
import { updateVillager } from "../src/ai/VillagerBrain";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { Building, BuildingType } from "../src/entities/Building";
import { createSettlementRecovery } from "../src/entities/Civilization";
import { SaveManager } from "../src/persistence/SaveManager";
import { serializeGame } from "../src/persistence/Serialization";
import { evaluateSettlementRecovery } from "../src/simulation/RecoverySystem";
import { Simulation } from "../src/simulation/Simulation";
import { triggerRiot } from "../src/simulation/StabilitySystem";
import { getTile } from "../src/world/World";

function recoveryState(seed: string) {
  const state = createNewGameState(seed, 64);
  const settlement = state.settlements[0];
  settlement.tier = "village";
  settlement.population = Math.max(8, state.villagers.length);
  settlement.abstractPopulation = settlement.population - state.villagers.length;
  settlement.housingCapacity = settlement.population;
  settlement.recovery = createSettlementRecovery();
  state.civilizations[0].population = settlement.population;
  return { state, settlement };
}

function addBuilding(
  state: ReturnType<typeof createNewGameState>,
  type: BuildingType,
  offsetX: number,
  offsetY: number,
  complete = true
): Building {
  const settlement = state.settlements[0];
  const building = createBuildingAt(
    state,
    type,
    state.world.spawn.x + offsetX,
    state.world.spawn.y + offsetY,
    complete
  );
  building.civilizationId = settlement.civilizationId;
  building.settlementId = settlement.id;
  settlement.buildingIds.push(building.id);
  return building;
}

describe("settlement recovery", () => {
  it("plans new food production after the farm is destroyed", () => {
    const { state, settlement } = recoveryState("recovery-farm");
    state.resources.food = 0;

    evaluateSettlementRecovery(state, settlement);

    expect(
      state.buildings.some(
        (building) =>
          building.settlementId === settlement.id &&
          building.type === "farm" &&
          building.status !== "complete"
      )
    ).toBe(true);
  });

  it("creates a repair task for a damaged home", () => {
    const { state, settlement } = recoveryState("recovery-house");
    const house = addBuilding(state, "house", 10, 6);
    house.health = 35;

    evaluateSettlementRecovery(state, settlement);

    expect(settlement.recovery!.tasks.some((task) => task.type === "repairBuilding" && task.buildingId === house.id)).toBe(true);
    expect(house.repairing).toBe(true);
    expect(house.status).toBe("building");
  });

  it("clears rubble before rebuilding on the same footprint", () => {
    const { state, settlement } = recoveryState("recovery-rubble");
    const farm = addBuilding(state, "farm", 11, 7, false);
    farm.ruined = true;
    farm.damageState = "ruined";
    farm.health = 0;
    state.villagers = state.villagers.slice(0, 1);

    evaluateSettlementRecovery(state, settlement);

    expect(farm.ruined).toBe(true);
    expect(farm.cleanupProgress).toBeGreaterThan(0);
    expect(farm.status).toBe("planned");
    for (let pass = 0; pass < 4; pass += 1) evaluateSettlementRecovery(state, settlement);
    expect(farm.ruined).toBe(false);
    expect(settlement.recovery!.tasks.some((task) => task.type === "rebuildBuilding" && task.buildingId === farm.id)).toBe(true);
  });

  it("resets a resident whose target building was removed", () => {
    const { state } = recoveryState("recovery-target");
    const target = addBuilding(state, "farm", 10, 8, false);
    const villager = state.villagers[0];
    villager.targetBuildingId = target.id;
    villager.state = "walkToBuildSite";
    villager.path = [{ x: target.x, y: target.y }];
    state.buildings = state.buildings.filter((building) => building.id !== target.id);

    updateVillager(villager, state, 1);

    expect(villager.state).toBe("idle");
    expect(villager.targetBuildingId).toBeUndefined();
    expect(villager.path).toHaveLength(0);
  });

  it("does not leave residents permanently fleeing after danger is gone", () => {
    const { state } = recoveryState("recovery-flee");
    const villager = state.villagers[0];
    villager.state = "fleeFire";
    villager.stateElapsed = 43;
    villager.stuckElapsed = 43;
    villager.path = [{ x: Math.floor(villager.x) + 1, y: Math.floor(villager.y) }];

    updateVillager(villager, state, 1);

    expect(villager.state).toBe("idle");
    expect(villager.stuckResets).toBeGreaterThan(0);
  });

  it("can bootstrap wood by gathering directly without wood production", () => {
    const { state } = recoveryState("recovery-wood");
    state.resources.wood = 0;
    state.resources.food = 100;
    state.buildings = state.buildings.filter(
      (building) => building.type !== "woodcutter" && building.type !== "forestry"
    );
    const villager = state.villagers[0];
    villager.job = "woodcutter";
    for (let tick = 0; tick < 120 && state.resources.wood === 0; tick += 1) {
      updateVillager(villager, state, 1);
    }
    expect(state.resources.wood).toBeGreaterThan(0);
  });

  it("does not create duplicate recovery assignments", () => {
    const { state, settlement } = recoveryState("recovery-dedup");
    state.resources.food = 0;
    evaluateSettlementRecovery(state, settlement);
    evaluateSettlementRecovery(state, settlement);
    const keys = settlement.recovery!.tasks
      .filter((task) => task.status !== "completed" && task.status !== "cancelled")
      .map((task) => `${task.type}:${task.buildingId ?? ""}:${task.buildingType ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("prioritizes food and pauses luxury construction during a crisis", () => {
    const { state, settlement } = recoveryState("recovery-priority");
    const monument = addBuilding(state, "monument", 12, 8, false);
    state.resources.food = 0;

    evaluateSettlementRecovery(state, settlement);

    expect(settlement.recovery!.priorities[0]).toContain("voedsel");
    expect(monument.pausedForRecovery).toBe(true);
    expect(state.buildings.some((building) => building.type === "farm" && building.emergencyBuilt)).toBe(true);
  });

  it("leaves recovery only after several healthy evaluations", () => {
    const { state, settlement } = recoveryState("recovery-exit");
    addBuilding(state, "farm", 10, 6);
    addBuilding(state, "house", 14, 6);
    addBuilding(state, "woodcutter", 10, 11);
    state.resources.food = 200;
    settlement.foodProduction = 20;
    settlement.housingCapacity = settlement.population + 4;
    settlement.recovery!.state = "emergency";

    evaluateSettlementRecovery(state, settlement);
    expect(settlement.recovery!.state).toBe("recovering");
    evaluateSettlementRecovery(state, settlement);
    expect(settlement.recovery!.state).toBe("recovering");
    evaluateSettlementRecovery(state, settlement);
    expect(settlement.recovery!.state).toBe("normal");
  });

  it("loads an older save without recovery data", () => {
    const state = createNewGameState("recovery-save", 64);
    const save = serializeGame(state);
    for (const settlement of save.settlements ?? []) delete settlement.recovery;

    const restored = new SaveManager().restoreState(save);

    expect(restored.settlements[0].recovery?.state).toBe("normal");
    expect(restored.villagers[0].stateElapsed).toBe(0);
  });

  it("deduplicates repeated food riot history", () => {
    const { state, settlement } = recoveryState("recovery-riot");
    for (let count = 0; count < 6; count += 1) triggerRiot(state, settlement, 82);

    expect(
      state.historicEvents.filter(
        (event) => event.type === "rebellion" && event.settlementId === settlement.id
      )
    ).toHaveLength(1);
  });

  it("eventually resumes food production with living residents and valid resources", () => {
    const { state, settlement } = recoveryState("recovery-resume");
    state.resources.food = 1;
    state.resources.wood = 24;
    const nearby = getTile(state.world, state.world.spawn.x + 4, state.world.spawn.y + 4);
    if (nearby) {
      nearby.type = "grass";
      nearby.fertility = 0.9;
      nearby.resourceAmount = 8;
      nearby.occupiedByBuildingId = undefined;
    }
    const simulation = new Simulation();

    for (let tick = 0; tick < 500; tick += 1) simulation.update(state, 1);

    expect(
      state.buildings.some(
        (building) => building.settlementId === settlement.id && building.type === "farm" && building.status === "complete"
      )
    ).toBe(true);
    expect(settlement.foodProduction).toBeGreaterThan(0);
  });
});
