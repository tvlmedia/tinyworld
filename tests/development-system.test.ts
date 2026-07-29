import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { developmentStageFor } from "../src/config/developmentConfig";
import { updateDevelopment } from "../src/simulation/DevelopmentSystem";

describe("rule-based civilization development", () => {
  it("derives development phases from population, settlements and capital tier", () => {
    const state = createNewGameState("development-stage", 64);
    const civilization = state.civilizations[0];
    const capital = state.settlements[0];

    civilization.population = 82;
    capital.population = 82;
    capital.tier = "town";

    expect(developmentStageFor(civilization, [capital]).id).toBe("fortifiedVillage");
  });

  it("plans one persistent central fort and a shaped defense ring", () => {
    const state = createNewGameState("development-build", 64);
    const civilization = state.civilizations[0];
    const capital = state.settlements[0];
    civilization.population = 84;
    capital.population = 84;
    capital.tier = "town";
    state.resources.wood = 500;
    state.resources.stone = 500;
    state.resources.food = 500;
    state.civilizationTimers.development = 0;

    updateDevelopment(state, 1);

    const castles = state.buildings.filter(
      (building) => building.type === "castle" && building.civilizationId === civilization.id
    );
    const defenses = state.buildings.filter(
      (building) =>
        (building.type === "wall" || building.type === "gate") &&
        building.settlementId === capital.id
    );
    expect(castles).toHaveLength(1);
    expect(castles[0].status).toBe("planned");
    expect(defenses).toHaveLength(1);
  });

  it("upgrades the same castle after masonry is discovered", () => {
    const state = createNewGameState("castle-upgrade", 64);
    const civilization = state.civilizations[0];
    const capital = state.settlements[0];
    civilization.population = 126;
    civilization.unlockedTechnologyIds.push("masonry");
    capital.population = 126;
    capital.tier = "city";
    state.resources.wood = 500;
    state.resources.stone = 500;
    state.resources.food = 500;
    const castle = createBuildingAt(state, "castle", capital.centerX + 12, capital.centerY + 8);
    castle.civilizationId = civilization.id;
    castle.settlementId = capital.id;
    castle.status = "complete";
    castle.progress = castle.workRequired;
    castle.upgradeLevel = 1;
    capital.buildingIds.push(castle.id);
    state.civilizationTimers.development = 0;

    updateDevelopment(state, 1);

    expect(state.buildings.filter((building) => building.type === "castle")).toHaveLength(1);
    expect(castle.status).toBe("building");
    expect(castle.upgradeTargetLevel).toBe(2);
  });
});
