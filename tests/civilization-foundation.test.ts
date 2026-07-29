import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { updateCivilization } from "../src/simulation/CivilizationSystem";
import { SaveManager } from "../src/persistence/SaveManager";
import { serializeGame } from "../src/persistence/Serialization";
import {
  findFoundationSite,
  foundIndependentCivilizationAt
} from "../src/simulation/CivilizationFoundationSystem";
import { TOOL_DEFINITIONS, useToolAt } from "../src/input/ToolManager";

describe("civilization foundation", () => {
  it("creates the first civilization and settlement from a new world", () => {
    const state = createNewGameState("first-civilization", 64);
    expect(state.civilizations).toHaveLength(1);
    expect(state.settlements).toHaveLength(1);
    expect(state.civilizations[0].capitalSettlementId).toBe(state.settlements[0].id);
    expect(state.settlements[0].buildingIds.length).toBeGreaterThan(0);
    expect(state.villagers.every((villager) => villager.civilizationId === state.civilizations[0].id)).toBe(true);
  });

  it("assigns territory around the capital settlement", () => {
    const state = createNewGameState("territory", 64);
    updateCivilization(state, 1);
    const ownedTiles = state.territory.ownerByTile.filter((owner) => owner === state.civilizations[0].id).length;
    expect(ownedTiles).toBeGreaterThan(20);
  });

  it("keeps restored legacy saves playable by bootstrapping civilization data", () => {
    const state = createNewGameState("legacy-bootstrap", 64);
    createBuildingAt(state, "house", state.world.spawn.x + 7, state.world.spawn.y + 4, true);
    const save = serializeGame(state);
    const legacy = {
      ...save,
      version: 2,
      civilizations: undefined,
      settlements: undefined,
      territory: undefined,
      historicEvents: undefined
    };
    const restored = new SaveManager().restoreState(legacy);
    expect(restored.civilizations).toHaveLength(1);
    expect(restored.settlements).toHaveLength(1);
    expect(restored.buildings.every((building) => building.civilizationId === restored.civilizations[0].id)).toBe(true);
  });

  it("founds a complete independent civilization at a chosen remote site", () => {
    const state = createNewGameState("manual-civilization", 128);
    const site = remoteFoundationSite(state);
    expect(site).toBeDefined();

    const result = foundIndependentCivilizationAt(state, site!.x, site!.y);

    expect(result.founded).toBe(true);
    expect(state.civilizations).toHaveLength(2);
    expect(state.settlements).toHaveLength(2);
    expect(result.settlement?.residentIds).toHaveLength(5);
    expect(result.settlement?.buildingIds).toHaveLength(2);
    expect(result.settlement?.recovery?.state).toBe("normal");
    expect(state.selectedCivilizationId).toBe(result.civilization?.id);
    expect(state.villagers.filter((villager) => villager.civilizationId === result.civilization?.id)).toHaveLength(5);
  });

  it("exposes a one-shot new civilization map tool", () => {
    const state = createNewGameState("civilization-tool", 128);
    const site = remoteFoundationSite(state);
    expect(TOOL_DEFINITIONS.some((tool) => tool.id === "civilization" && tool.label === "Nieuwe civ")).toBe(true);
    expect(site).toBeDefined();

    state.activeTool = "civilization";
    expect(useToolAt(state, "civilization", site!.x, site!.y)).toBe(true);
    expect(state.civilizations).toHaveLength(2);
    expect(state.activeTool).toBe("inspect");
  });
});

function remoteFoundationSite(state: ReturnType<typeof createNewGameState>) {
  for (const tile of state.world.tiles) {
    if (Math.hypot(tile.x - state.world.spawn.x, tile.y - state.world.spawn.y) <= 32) continue;
    const site = findFoundationSite(state, tile.x, tile.y);
    if (site) return site;
  }
  return undefined;
}
