import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { Civilization, Settlement } from "../src/entities/Civilization";
import { canTrade, deliverTradeRoute, getRelation, updateDiplomacyAndTrade } from "../src/simulation/DiplomacySystem";

function addNeighborCivilization(state = createNewGameState("diplomacy", 64)) {
  const a = state.civilizations[0];
  const origin = state.settlements[0];
  const b: Civilization = {
    ...a,
    id: "civ-b",
    name: "Test League",
    colorIndex: 2,
    capitalSettlementId: "settlement-b",
    settlementIds: ["settlement-b"],
    traits: ["mercantile"],
    knownCivilizationIds: [],
    activeTreatyIds: [],
    activeWarIds: [],
    treasury: 0
  };
  const settlement: Settlement = {
    ...origin,
    id: "settlement-b",
    civilizationId: b.id,
    name: "Tradeholm",
    centerX: origin.centerX + 24,
    centerY: origin.centerY,
    population: 18,
    foodSecurity: 78,
    woodProduction: 18,
    stoneProduction: 2,
    wealthProduction: 12,
    connectedSettlementIds: []
  };
  origin.population = 22;
  origin.foodSecurity = 42;
  origin.woodProduction = 4;
  origin.stoneProduction = 12;
  origin.wealthProduction = 2;
  state.civilizations.push(b);
  state.settlements.push(settlement);
  return { state, a, b, origin, settlement };
}

describe("diplomacy and trade", () => {
  it("discovers nearby civilizations and creates asymmetric relations", () => {
    const { state, a, b } = addNeighborCivilization();
    state.civilizationTimers.diplomacy = 0;
    updateDiplomacyAndTrade(state, 1);
    const relation = getRelation(state, a.id, b.id);
    expect(relation).toBeDefined();
    expect(a.knownCivilizationIds).toContain(b.id);
    expect(b.knownCivilizationIds).toContain(a.id);
  });

  it("allows trade when relations, distance and complementary economy are valid", () => {
    const { state, a, b } = addNeighborCivilization();
    state.civilizationTimers.diplomacy = 0;
    updateDiplomacyAndTrade(state, 1);
    expect(canTrade(state, a, b)).toBe(true);
  });

  it("creates trade routes and delivers wealth/research over time", () => {
    const { state, a, b } = addNeighborCivilization();
    state.civilizationTimers.diplomacy = 0;
    state.civilizationTimers.trade = 0;
    updateDiplomacyAndTrade(state, 1);
    expect(state.tradeRoutes.length).toBeGreaterThan(0);
    const beforeTreasury = state.civilizations.find((civ) => civ.id === a.id)!.treasury + state.civilizations.find((civ) => civ.id === b.id)!.treasury;
    deliverTradeRoute(state, state.tradeRoutes[0]);
    const afterTreasury = state.civilizations.find((civ) => civ.id === a.id)!.treasury + state.civilizations.find((civ) => civ.id === b.id)!.treasury;
    expect(afterTreasury).toBeGreaterThan(beforeTreasury);
  });
});
