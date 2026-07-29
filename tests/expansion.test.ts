import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { ColonistGroup } from "../src/entities/Civilization";
import { evaluateSettlementTier, scoreExpansionLocation, updateExpansion } from "../src/simulation/ExpansionSystem";
import { updateCivilization } from "../src/simulation/CivilizationSystem";
import { getTile } from "../src/world/World";

describe("settlement expansion", () => {
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
    const state = createNewGameState("expansion-score", 64);
    const origin = state.settlements[0];
    const civ = state.civilizations[0];
    const good = { x: origin.centerX + 22, y: origin.centerY };
    const bad = { x: origin.centerX - 22, y: origin.centerY };
    for (let y = good.y - 3; y <= good.y + 3; y += 1) {
      for (let x = good.x - 3; x <= good.x + 3; x += 1) {
        const tile = getTile(state.world, x, y);
        if (tile) {
          tile.type = x === good.x ? "forest" : "grass";
          tile.fertility = 0.9;
          tile.resourceAmount = 4;
        }
      }
    }
    const badTile = getTile(state.world, bad.x, bad.y)!;
    badTile.type = "burned";
    badTile.fertility = 0.1;
    expect(scoreExpansionLocation(state, civ, origin, good)).toBeGreaterThan(scoreExpansionLocation(state, civ, origin, bad));
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
});
