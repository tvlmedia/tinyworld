import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { Civilization, Settlement } from "../src/entities/Civilization";
import { createWorldReport, reportSummary } from "../src/simulation/WorldReport";
import { calculateUnrest, collapseCivilization, triggerSecession } from "../src/simulation/StabilitySystem";

function addUnstableOutpost() {
  const state = createNewGameState("stability", 64);
  const civ = state.civilizations[0];
  const capital = state.settlements[0];
  capital.population = 34;
  capital.housingCapacity = 20;
  civ.population = 60;
  civ.settlementIds = [capital.id, "settlement-outpost"];
  civ.stability = 34;
  const outpost: Settlement = {
    ...capital,
    id: "settlement-outpost",
    name: "Onrustmark",
    centerX: capital.centerX + 22,
    centerY: capital.centerY,
    population: 26,
    abstractPopulation: 26,
    housingCapacity: 5,
    foodSecurity: 18,
    happiness: 24,
    stability: 15,
    defense: 3,
    buildingIds: [],
    residentIds: [],
    connectedSettlementIds: []
  };
  state.settlements.push(outpost);
  return { state, civ, capital, outpost };
}

describe("stability and reporting", () => {
  it("calculates high unrest from hunger, housing shortage and low stability", () => {
    const { state, civ, outpost } = addUnstableOutpost();
    expect(calculateUnrest(state, civ, outpost)).toBeGreaterThan(85);
  });

  it("creates a secession civilization and an independence war", () => {
    const { state, civ, outpost } = addUnstableOutpost();
    const rebel = triggerSecession(state, outpost, "testonrust");
    expect(rebel).toBeDefined();
    expect(outpost.civilizationId).toBe(rebel!.id);
    expect(state.wars.some((war) => war.active && war.goal === "independence")).toBe(true);
    expect(state.diplomaticRelations.some((relation) => relation.status === "atWar" && relation.civilizationBId === civ.id)).toBe(true);
  });

  it("collapses civilizations that no longer have viable population", () => {
    const { state, civ } = addUnstableOutpost();
    const failed: Civilization = {
      ...civ,
      id: "failed-civ",
      name: "Failed Realm",
      capitalSettlementId: "missing",
      settlementIds: [],
      population: 0,
      stability: 0,
      activeWarIds: [],
      activeTreatyIds: []
    };
    state.civilizations.push(failed);
    collapseCivilization(state, failed, "test");
    expect(state.civilizations.some((item) => item.id === failed.id)).toBe(false);
  });

  it("creates compact world reports for balancing", () => {
    const { state, outpost } = addUnstableOutpost();
    triggerSecession(state, outpost, "rapporttest");
    const report = createWorldReport(state);
    expect(report.civilizations).toBe(2);
    expect(report.activeWars).toBe(1);
    expect(report.eventCounts.rebellion).toBeGreaterThan(0);
    expect(reportSummary(state)).toContain("civs");
  });
});

