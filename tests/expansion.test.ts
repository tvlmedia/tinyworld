import { describe, expect, it } from "vitest";
import { DEFAULT_WORLD_SIZE, WORLD_SIZES } from "../src/app/Config";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { ColonistGroup, Settlement } from "../src/entities/Civilization";
import { connectSettlementsWithRoad, evaluateSettlementTier, maintainRoadNetworks, scoreExpansionLocation, updateExpansion } from "../src/simulation/ExpansionSystem";
import { updateCivilization } from "../src/simulation/CivilizationSystem";
import { findBuildingSpot } from "../src/simulation/SettlementPlanner";
import { getTile } from "../src/world/World";

describe("settlement expansion", () => {
  it("offers larger worlds than the original 128 map", () => {
    expect(DEFAULT_WORLD_SIZE).toBe(512);
    expect(WORLD_SIZES).toContain(128);
    expect(WORLD_SIZES).toContain(256);
    expect(WORLD_SIZES).toContain(512);
    expect(createNewGameState("large-world", 512).world.width).toBe(512);
  });

  it("upgrades settlements with buildings, food security, defense and connections", () => {
    const state = createNewGameState("tier-progression", 64);
    const settlement = state.settlements[0];
    const civ = state.civilizations[0];
    const types = ["house", "house", "farm", "farm", "storage", "market", "woodcutter", "mine", "workshop", "watchtower"] as const;
    for (let index = 0; index < types.length; index += 1) {
      const building = createBuildingAt(
        state,
        types[index],
        state.world.spawn.x + 7 + (index % 4) * 5,
        state.world.spawn.y + 4 + Math.floor(index / 4) * 5,
        true
      );
      building.settlementId = settlement.id;
      building.civilizationId = civ.id;
    }
    settlement.population = 86;
    settlement.abstractPopulation = 81;
    settlement.foodSecurity = 70;
    settlement.defense = 20;
    settlement.connectedSettlementIds = ["other"];
    expect(evaluateSettlementTier(state, settlement)).toBe("town");
  });

  it("scores fertile resource-rich expansion sites above bad terrain", () => {
    const state = createNewGameState("expansion-score", 128);
    const origin = state.settlements[0];
    const civ = state.civilizations[0];
    const good = { x: origin.centerX + 54, y: origin.centerY };
    const bad = { x: origin.centerX - 54, y: origin.centerY };
    for (let y = good.y - 7; y <= good.y + 7; y += 1) {
      for (let x = good.x - 7; x <= good.x + 7; x += 1) {
        const tile = getTile(state.world, x, y);
        if (tile) {
          tile.type = Math.abs(x - good.x) > 4 ? "forest" : "grass";
          tile.fertility = 0.9;
          tile.resourceAmount = 4;
          tile.occupiedByBuildingId = undefined;
        }
      }
    }
    const badTile = getTile(state.world, bad.x, bad.y)!;
    badTile.type = "burned";
    badTile.fertility = 0.1;
    expect(scoreExpansionLocation(state, civ, origin, good)).toBeGreaterThan(scoreExpansionLocation(state, civ, origin, bad));
  });

  it("rejects settlement sites closer than 50 tiles to an existing center", () => {
    const state = createNewGameState("minimum-distance", 128);
    const origin = state.settlements[0];
    const civ = state.civilizations[0];
    const tile = getTile(state.world, origin.centerX + 32, origin.centerY)!;
    tile.type = "grass";
    tile.occupiedByBuildingId = undefined;
    expect(scoreExpansionLocation(state, civ, origin, { x: origin.centerX + 32, y: origin.centerY })).toBe(-Infinity);
  });

  it("turns a traveling colonist group into a physical settlement", () => {
    const state = createNewGameState("colony-founding", 64);
    updateCivilization(state, 1);
    const origin = state.settlements[0];
    const civ = state.civilizations[0];
    const target = { x: origin.centerX + 20, y: origin.centerY + 3 };
    for (let y = target.y - 2; y <= target.y + 2; y += 1) {
      for (let x = target.x - 2; x <= target.x + 4; x += 1) {
        const tile = getTile(state.world, x, y);
        if (tile) {
          tile.type = "grass";
          tile.occupiedByBuildingId = undefined;
        }
      }
    }
    const group: ColonistGroup = {
      id: state.ids.next("colonists"),
      civilizationId: civ.id,
      originSettlementId: origin.id,
      x: target.x - 1,
      y: target.y,
      targetX: target.x,
      targetY: target.y,
      settlers: 4,
      resources: { food: 20, wood: 16, stone: 0 },
      targetName: "Teststead",
      state: "traveling"
    };
    state.colonistGroups.push(group);
    state.civilizationTimers.civilizationStrategy = 999;
    updateExpansion(state, 2);
    expect(state.colonistGroups).toHaveLength(0);
    expect(state.settlements.some((settlement) => settlement.name === "Teststead")).toBe(true);
    expect(state.buildings.some((building) => building.settlementId === state.settlements.at(-1)?.id)).toBe(true);
  });

  it("can send another colony while one group is already traveling for the same civilization", () => {
    const state = createNewGameState("many-villages", 96);
    for (const tile of state.world.tiles) {
      tile.type = "grass";
      tile.fertility = 0.88;
      tile.resourceAmount = 3;
      tile.occupiedByBuildingId = undefined;
    }
    for (const building of state.buildings) {
      for (let y = building.y; y < building.y + building.height; y += 1) {
        for (let x = building.x; x < building.x + building.width; x += 1) {
          const tile = getTile(state.world, x, y);
          if (tile) tile.occupiedByBuildingId = building.id;
        }
      }
    }
    const origin = state.settlements[0];
    const civ = state.civilizations[0];
    origin.population = 54;
    origin.abstractPopulation = 49;
    origin.housingCapacity = 20;
    origin.foodSecurity = 72;
    civ.population = 54;
    state.resources.food = 500;
    state.resources.wood = 500;
    state.colonistGroups.push({
      id: state.ids.next("colonists"),
      civilizationId: civ.id,
      originSettlementId: origin.id,
      x: origin.centerX,
      y: origin.centerY,
      targetX: origin.centerX + 24,
      targetY: origin.centerY,
      settlers: 5,
      resources: { food: 18, wood: 12, stone: 0 },
      targetName: "Firstfield",
      state: "traveling"
    });
    state.civilizationTimers.civilizationStrategy = 0;
    updateExpansion(state, 1);
    expect(state.colonistGroups.filter((group) => group.civilizationId === civ.id)).toHaveLength(2);
  });

  it("builds road network links between separate settlements", () => {
    const state = createNewGameState("road-network", 96);
    for (const tile of state.world.tiles) {
      tile.type = "grass";
      tile.occupiedByBuildingId = undefined;
    }
    const origin = state.settlements[0];
    const civ = state.civilizations[0];
    const outpost: Settlement = {
      ...origin,
      id: "settlement-road",
      name: "Roadwick",
      centerX: origin.centerX + 28,
      centerY: origin.centerY + 6,
      population: 8,
      abstractPopulation: 8,
      buildingIds: [],
      residentIds: [],
      connectedSettlementIds: []
    };
    state.settlements.push(outpost);
    civ.settlementIds.push(outpost.id);
    state.resources.wood = 100;
    const built = connectSettlementsWithRoad(state, origin, outpost);
    expect(built).toBeGreaterThan(0);
    expect(origin.connectedSettlementIds).toContain(outpost.id);
    expect(outpost.connectedSettlementIds).toContain(origin.id);
    expect(state.world.tiles.some((tile) => tile.type === "road")).toBe(true);
  });

  it("repairs missing road links across a civilization network", () => {
    const state = createNewGameState("road-maintenance", 96);
    for (const tile of state.world.tiles) {
      tile.type = "grass";
      tile.occupiedByBuildingId = undefined;
    }
    const origin = state.settlements[0];
    const civ = state.civilizations[0];
    const outpost: Settlement = {
      ...origin,
      id: "settlement-maintained-road",
      name: "Netmere",
      centerX: origin.centerX - 24,
      centerY: origin.centerY + 9,
      population: 9,
      abstractPopulation: 9,
      buildingIds: [],
      residentIds: [],
      connectedSettlementIds: []
    };
    state.settlements.push(outpost);
    civ.settlementIds.push(outpost.id);
    state.resources.wood = 100;
    expect(maintainRoadNetworks(state)).toBeGreaterThan(0);
    expect(outpost.connectedSettlementIds).toContain(origin.id);
  });

  it("places new village buildings around their own center instead of the original spawn", () => {
    const state = createNewGameState("local-building-spot", 128);
    for (const tile of state.world.tiles) {
      tile.type = "grass";
      tile.occupiedByBuildingId = undefined;
      tile.fertility = 0.7;
    }
    const villageCenter = { x: 94, y: 92 };
    const spot = findBuildingSpot(state, "house", villageCenter);
    expect(spot).toBeDefined();
    const distanceToVillage = Math.hypot(spot!.x - villageCenter.x, spot!.y - villageCenter.y);
    const distanceToSpawn = Math.hypot(spot!.x - state.world.spawn.x, spot!.y - state.world.spawn.y);
    expect(distanceToVillage).toBeLessThan(distanceToSpawn);
  });
});
