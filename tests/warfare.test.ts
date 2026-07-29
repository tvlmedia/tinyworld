import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { Civilization, DiplomaticRelation, Settlement, TradeRoute } from "../src/entities/Civilization";
import { calculateWarDesirability, declareWar, mobilizeArmy, resolveBattle, updateWarfare } from "../src/simulation/WarfareSystem";

function addRivalCivilization() {
  const state = createNewGameState("warfare", 64);
  const a = state.civilizations[0];
  const origin = state.settlements[0];
  origin.population = 36;
  origin.abstractPopulation = 31;
  origin.foodSecurity = 34;
  origin.defense = 8;
  a.population = 36;
  a.foodSecurity = 34;
  a.warSupport = 78;
  a.militaryStrength = 42;
  a.traits = ["militaristic"];

  const b: Civilization = {
    ...a,
    id: "civ-rival",
    name: "Rivalen",
    colorIndex: 3,
    traits: ["isolationist"],
    capitalSettlementId: "settlement-rival",
    settlementIds: ["settlement-rival"],
    knownCivilizationIds: [a.id],
    activeTreatyIds: [],
    activeWarIds: [],
    population: 28,
    foodSecurity: 72,
    warSupport: 32,
    militaryStrength: 12,
    treasury: 0,
    storedResearch: 0
  };
  const target: Settlement = {
    ...origin,
    id: "settlement-rival",
    civilizationId: b.id,
    name: "Rivaldam",
    centerX: origin.centerX + 18,
    centerY: origin.centerY,
    population: 28,
    abstractPopulation: 28,
    defense: 2,
    stability: 62,
    residentIds: [],
    buildingIds: [],
    connectedSettlementIds: []
  };
  const relation: DiplomaticRelation = {
    civilizationAId: a.id,
    civilizationBId: b.id,
    opinionAOfB: -60,
    opinionBOfA: -52,
    trust: 12,
    fear: 0,
    tradeValue: 0,
    status: "hostile",
    grievances: [{ label: "grensconflict", value: 24 }],
    positiveModifiers: []
  };
  state.civilizations.push(b);
  state.settlements.push(target);
  state.diplomaticRelations.push(relation);
  return { state, a, b, origin, target, relation };
}

describe("warfare", () => {
  it("scores war desirability from hostility, scarcity and opportunity", () => {
    const { state, a, b } = addRivalCivilization();
    expect(calculateWarDesirability(state, a, b)).toBeGreaterThan(70);
  });

  it("mobilizes armies and marks available residents as soldiers", () => {
    const { state, a, target } = addRivalCivilization();
    a.unlockedTechnologyIds.push("woodworking", "metallurgy", "fortification");
    const army = mobilizeArmy(state, a, target);
    expect(army).toBeDefined();
    expect(army!.soldierIds.length).toBeGreaterThanOrEqual(4);
    expect(army!.unitComposition.archer).toBeGreaterThan(0);
    expect(army!.unitComposition.swordsman).toBeGreaterThan(0);
    expect(army!.unitComposition.shieldBearer).toBeGreaterThan(0);
    expect(state.villagers.filter((villager) => villager.armyId === army!.id).length).toBeGreaterThan(0);
  });

  it("resolves battles with casualties and morale changes", () => {
    const { state, a, b, origin, target } = addRivalCivilization();
    const attacker = mobilizeArmy(state, a, target)!;
    const defender = mobilizeArmy(state, b, origin, "war-test", "defending")!;
    const before = attacker.soldierIds.length + defender.soldierIds.length;
    resolveBattle(state, attacker, defender);
    const after = attacker.soldierIds.length + defender.soldierIds.length;
    expect(after).toBeLessThan(before);
    expect(attacker.morale).toBeLessThanOrEqual(100);
    expect(defender.morale).toBeLessThanOrEqual(100);
  });

  it("declares war and interrupts trade between combatants", () => {
    const { state, a, b, relation } = addRivalCivilization();
    const route: TradeRoute = {
      id: "trade-war",
      fromSettlementId: a.capitalSettlementId,
      toSettlementId: b.capitalSettlementId,
      civilizationAId: a.id,
      civilizationBId: b.id,
      goods: ["wealth"],
      value: 10,
      active: true,
      progress: 0.4
    };
    state.tradeRoutes.push(route);
    a.activeTreatyIds.push(route.id);
    b.activeTreatyIds.push(route.id);
    const war = declareWar(state, a, b);
    expect(war?.active).toBe(true);
    expect(relation.status).toBe("atWar");
    expect(state.tradeRoutes[0].active).toBe(false);
  });

  it("captures weak settlements when an army reaches the siege target", () => {
    const { state, a, b, target } = addRivalCivilization();
    const war = declareWar(state, a, b)!;
    state.armies = state.armies.filter((army) => army.civilizationId === a.id);
    const army = state.armies[0];
    army.x = target.centerX;
    army.y = target.centerY;
    army.targetX = target.centerX;
    army.targetY = target.centerY;
    army.strength = 900;
    army.morale = 100;
    army.supplies = 100;
    state.civilizationTimers.war = 999;
    updateWarfare(state, 1);
    expect(army.siegePhase).toBe("camp");
    expect(target.civilizationId).toBe(b.id);
    for (let tick = 0; tick < 40 && target.civilizationId !== a.id; tick += 1) {
      updateWarfare(state, 1);
    }
    expect(war.occupiedSettlementIds).toContain(target.id);
    expect(target.civilizationId).toBe(a.id);
    expect(state.historicEvents.some((event) => event.type === "siegeStarted")).toBe(true);
    expect(state.historicEvents.some((event) => event.type === "wallBreached")).toBe(true);
  });

  it("calls allied civilizations into the same war", () => {
    const { state, a, b, origin } = addRivalCivilization();
    const ally: Civilization = {
      ...a,
      id: "civ-ally",
      name: "Bondgenoten",
      capitalSettlementId: "settlement-ally",
      settlementIds: ["settlement-ally"],
      knownCivilizationIds: [a.id, b.id],
      activeTreatyIds: [],
      activeWarIds: [],
      warSupport: 70
    };
    const allySettlement: Settlement = {
      ...origin,
      id: "settlement-ally",
      civilizationId: ally.id,
      name: "Eikenwacht",
      centerX: origin.centerX - 12,
      residentIds: [],
      buildingIds: [],
      connectedSettlementIds: []
    };
    state.civilizations.push(ally);
    state.settlements.push(allySettlement);
    state.diplomaticRelations.push({
      civilizationAId: a.id,
      civilizationBId: ally.id,
      opinionAOfB: 75,
      opinionBOfA: 72,
      trust: 80,
      fear: 0,
      tradeValue: 12,
      status: "allied",
      grievances: [],
      positiveModifiers: [{ label: "bondgenootschap", value: 30 }]
    });

    const war = declareWar(state, a, b)!;

    expect(war.attackerCivilizationIds).toContain(ally.id);
    expect(ally.activeWarIds).toContain(war.id);
    expect(state.armies.some((army) => army.civilizationId === ally.id && army.warId === war.id)).toBe(true);
  });

  it("uses a plunder policy for resource wars", () => {
    const { state, a, b } = addRivalCivilization();

    const war = declareWar(state, a, b, "resources")!;

    expect(war.occupationPolicy).toBe("plunder");
  });
});
