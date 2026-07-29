import { GameState, worldYear } from "../app/GameState";
import { DIPLOMACY, TRADE } from "../config/diplomacyConfig";
import { Civilization, DiplomaticRelation, DiplomaticStatus, Settlement, TradeRoute } from "../entities/Civilization";
import { isWalkableTile } from "../world/Tile";
import { getTile } from "../world/World";
import { areLandConnected, hasHarbor } from "../world/Maritime";
import { foundIndependentCivilizationAt } from "./CivilizationFoundationSystem";
import { addHistoricalEvent } from "./HistorySystem";

export function updateDiplomacyAndTrade(state: GameState, dt: number): void {
  normalizeCivilizationNumbers(state);
  updateTradeRoutes(state, dt);
  state.civilizationTimers.diplomacy -= dt;
  state.civilizationTimers.trade -= dt;
  if (state.civilizationTimers.diplomacy <= 0) {
    state.civilizationTimers.diplomacy = 96;
    maybeSpawnIndependentCivilization(state);
    discoverCivilizations(state);
    updateRelations(state);
  }
  if (state.civilizationTimers.trade <= 0) {
    state.civilizationTimers.trade = 36;
    evaluateTradeRoutes(state);
  }
  normalizeCivilizationNumbers(state);
}

export function getRelation(state: GameState, civilizationAId: string, civilizationBId: string): DiplomaticRelation | undefined {
  return state.diplomaticRelations.find(
    (relation) =>
      (relation.civilizationAId === civilizationAId && relation.civilizationBId === civilizationBId) ||
      (relation.civilizationAId === civilizationBId && relation.civilizationBId === civilizationAId)
  );
}

export function canTrade(state: GameState, a: Civilization, b: Civilization): boolean {
  const relation = getRelation(state, a.id, b.id);
  if (!relation || relation.status === "unknown" || relation.status === "atWar" || relation.status === "hostile") return false;
  const opinion = relation.civilizationAId === a.id ? relation.opinionAOfB : relation.opinionBOfA;
  if (opinion < DIPLOMACY.tradeMinimumOpinion) return false;
  const pairSettlements = closestSettlementPair(state, a, b);
  if (!pairSettlements || pairSettlements.distance > TRADE.maxRouteDistance) return false;
  const crossesSea = !areLandConnected(state.world, pairSettlements.a, pairSettlements.b);
  if (crossesSea && (!hasHarbor(state, pairSettlements.a.id) || !hasHarbor(state, pairSettlements.b.id))) return false;
  return hasComplementaryEconomy(pairSettlements.a, pairSettlements.b);
}

function discoverCivilizations(state: GameState): void {
  for (let i = 0; i < state.civilizations.length; i += 1) {
    for (let j = i + 1; j < state.civilizations.length; j += 1) {
      const a = state.civilizations[i];
      const b = state.civilizations[j];
      const pair = closestSettlementPair(state, a, b);
      if (!pair || pair.distance > DIPLOMACY.discoveryDistance) continue;
      if (!a.knownCivilizationIds.includes(b.id)) a.knownCivilizationIds.push(b.id);
      if (!b.knownCivilizationIds.includes(a.id)) b.knownCivilizationIds.push(a.id);
      if (!getRelation(state, a.id, b.id)) {
        state.diplomaticRelations.push(createRelation(a, b));
        addHistoricalEvent(state, "allianceFormed", `${a.name} en ${b.name} leerden elkaar kennen.`, {
          civilizationId: a.id,
          x: pair.a.centerX,
          y: pair.a.centerY
        });
      }
    }
  }
}

function updateRelations(state: GameState): void {
  for (const relation of state.diplomaticRelations) {
    const a = state.civilizations.find((civilization) => civilization.id === relation.civilizationAId);
    const b = state.civilizations.find((civilization) => civilization.id === relation.civilizationBId);
    if (!a || !b || relation.status === "atWar") continue;
    const tradeBonus = relation.tradeValue * 0.08;
    const traitTension =
      (a.traits.includes("militaristic") || b.traits.includes("militaristic") ? -1.8 : 0) +
      (a.traits.includes("mercantile") || b.traits.includes("mercantile") ? 1.6 : 0) +
      (a.traits.includes("isolationist") || b.traits.includes("isolationist") ? -1 : 0);
    relation.opinionAOfB = clampOpinion(relation.opinionAOfB + DIPLOMACY.relationDrift * 0.2 + tradeBonus + traitTension);
    relation.opinionBOfA = clampOpinion(relation.opinionBOfA + DIPLOMACY.relationDrift * 0.2 + tradeBonus + traitTension);
    relation.trust = clampOpinion(relation.trust + tradeBonus * 0.7 + (relation.status === "friendly" ? 1 : 0));
    relation.fear = Math.max(0, Math.min(100, Math.abs(a.militaryStrength - b.militaryStrength) * 0.12));
    relation.status = relationStatus(relation);
  }
}

function evaluateTradeRoutes(state: GameState): void {
  for (let i = 0; i < state.civilizations.length; i += 1) {
    for (let j = i + 1; j < state.civilizations.length; j += 1) {
      const a = state.civilizations[i];
      const b = state.civilizations[j];
      if (!canTrade(state, a, b)) continue;
      if (state.tradeRoutes.some((route) => route.active && connectsCivilizations(route, a.id, b.id))) continue;
      const pair = closestSettlementPair(state, a, b);
      if (!pair) continue;
      const routeValue = TRADE.tradeValueBase + Math.round((safeNumber(pair.a.wealthProduction) + safeNumber(pair.b.wealthProduction)) / 3);
      const route: TradeRoute = {
        id: state.ids.next("trade"),
        fromSettlementId: pair.a.id,
        toSettlementId: pair.b.id,
        civilizationAId: a.id,
        civilizationBId: b.id,
        goods: tradeGoods(pair.a, pair.b),
        value: routeValue,
        active: true,
        progress: 0,
        transport: areLandConnected(state.world, pair.a, pair.b) ? "land" : "sea"
      };
      state.tradeRoutes.push(route);
      a.activeTreatyIds.push(route.id);
      b.activeTreatyIds.push(route.id);
      const relation = getRelation(state, a.id, b.id);
      if (relation) relation.tradeValue = safeNumber(relation.tradeValue) + routeValue;
      addHistoricalEvent(state, "tradeRoute", `${a.name} en ${b.name} openden een handelsroute.`, {
        civilizationId: a.id,
        settlementId: pair.a.id,
        x: pair.a.centerX,
        y: pair.a.centerY
      });
    }
  }
}

function updateTradeRoutes(state: GameState, dt: number): void {
  for (const route of state.tradeRoutes) {
    if (!route.active) continue;
    route.progress += TRADE.caravanSpeed * (route.transport === "sea" ? 1.3 : 1) * dt;
    if (route.progress < 1) continue;
    deliverTradeRoute(state, route);
  }
}

export function deliverTradeRoute(state: GameState, route: TradeRoute): void {
  route.progress = 0;
  const a = state.civilizations.find((civilization) => civilization.id === route.civilizationAId);
  const b = state.civilizations.find((civilization) => civilization.id === route.civilizationBId);
  if (!a || !b) {
    route.active = false;
    return;
  }
  const value = safeNumber(route.value) || TRADE.tradeValueBase;
  const deliveryWealth = safeNumber(TRADE.wealthPerDelivery) + value * 0.12;
  a.treasury = safeNumber(a.treasury) + deliveryWealth;
  b.treasury = safeNumber(b.treasury) + deliveryWealth;
  a.storedResearch = safeNumber(a.storedResearch) + safeNumber(TRADE.researchSpread);
  b.storedResearch = safeNumber(b.storedResearch) + safeNumber(TRADE.researchSpread);
  const relation = getRelation(state, a.id, b.id);
  if (relation) {
    relation.opinionAOfB = clampOpinion(relation.opinionAOfB + 1.5);
    relation.opinionBOfA = clampOpinion(relation.opinionBOfA + 1.5);
    relation.trust = clampOpinion(relation.trust + 1);
  }
}

function maybeSpawnIndependentCivilization(state: GameState): void {
  if (state.civilizations.length >= 2 || worldYear(state) < 35) return;
  const origin = state.settlements[0];
  if (!origin || origin.population < 18) return;
  let best: { x: number; y: number; score: number } | undefined;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const angle = state.rng.float(0, Math.PI * 2);
    const radius = state.rng.float(28, 54);
    const x = Math.floor(origin.centerX + Math.cos(angle) * radius);
    const y = Math.floor(origin.centerY + Math.sin(angle) * radius);
    const tile = getTile(state.world, x, y);
    if (!tile || !isWalkableTile(tile) || tile.occupiedByBuildingId) continue;
    const score = tile.fertility * 20 + (tile.type === "forest" ? 8 : 0) + state.rng.float(-2, 2);
    if (!best || score > best.score) best = { x, y, score };
  }
  if (!best || best.score < 8) return;
  foundIndependentCivilizationAt(state, best.x, best.y);
}

function createRelation(a: Civilization, b: Civilization): DiplomaticRelation {
  const tension = a.traits.includes("militaristic") || b.traits.includes("militaristic") ? -12 : 0;
  const trade = a.traits.includes("mercantile") || b.traits.includes("mercantile") ? 12 : 0;
  return {
    civilizationAId: a.id,
    civilizationBId: b.id,
    opinionAOfB: 5 + tension + trade,
    opinionBOfA: 5 + tension + trade,
    trust: 28 + trade,
    fear: 0,
    tradeValue: 0,
    status: "neutral",
    grievances: [],
    positiveModifiers: []
  };
}

function relationStatus(relation: DiplomaticRelation): DiplomaticStatus {
  const averageOpinion = (relation.opinionAOfB + relation.opinionBOfA) / 2;
  if (averageOpinion >= DIPLOMACY.allianceThreshold && relation.trust > 64) return "allied";
  if (averageOpinion >= DIPLOMACY.friendlyThreshold) return "friendly";
  if (averageOpinion <= DIPLOMACY.hostileThreshold || relation.fear > 75) return "hostile";
  return "neutral";
}

function closestSettlementPair(state: GameState, a: Civilization, b: Civilization): { a: Settlement; b: Settlement; distance: number } | undefined {
  const settlementsA = state.settlements.filter((settlement) => settlement.civilizationId === a.id);
  const settlementsB = state.settlements.filter((settlement) => settlement.civilizationId === b.id);
  let best: { a: Settlement; b: Settlement; distance: number } | undefined;
  for (const settlementA of settlementsA) {
    for (const settlementB of settlementsB) {
      const distance = Math.hypot(settlementA.centerX - settlementB.centerX, settlementA.centerY - settlementB.centerY);
      if (!best || distance < best.distance) best = { a: settlementA, b: settlementB, distance };
    }
  }
  return best;
}

function hasComplementaryEconomy(a: Settlement, b: Settlement): boolean {
  const foodGap = Math.abs(a.foodSecurity - b.foodSecurity) > 12;
  const productionGap =
    Math.abs(a.woodProduction - b.woodProduction) > 5 ||
    Math.abs(a.stoneProduction - b.stoneProduction) > 5 ||
    Math.abs(a.wealthProduction - b.wealthProduction) > 4;
  return foodGap || productionGap || a.wealthProduction + b.wealthProduction > 8;
}

function tradeGoods(a: Settlement, b: Settlement): TradeRoute["goods"] {
  const goods = [] as TradeRoute["goods"];
  if (a.foodSecurity > b.foodSecurity + 8 || b.foodSecurity > a.foodSecurity + 8) goods.push("food");
  if (Math.max(a.woodProduction, b.woodProduction) > 8) goods.push("wood");
  if (Math.max(a.stoneProduction, b.stoneProduction) > 6) goods.push("stone");
  if (Math.max(a.wealthProduction, b.wealthProduction) > 4) goods.push("wealth");
  return goods.length > 0 ? goods : ["wealth"];
}

function connectsCivilizations(route: TradeRoute, a: string, b: string): boolean {
  return (route.civilizationAId === a && route.civilizationBId === b) || (route.civilizationAId === b && route.civilizationBId === a);
}

function clampOpinion(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

function safeNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeCivilizationNumbers(state: GameState): void {
  for (const civilization of state.civilizations) {
    civilization.treasury = safeNumber(civilization.treasury);
    civilization.storedResearch = safeNumber(civilization.storedResearch);
    civilization.militaryStrength = safeNumber(civilization.militaryStrength);
    civilization.economicStrength = safeNumber(civilization.economicStrength);
    civilization.technologicalStrength = safeNumber(civilization.technologicalStrength);
    civilization.stability = safeNumber(civilization.stability);
    civilization.prosperity = safeNumber(civilization.prosperity);
    civilization.foodSecurity = safeNumber(civilization.foodSecurity);
    civilization.warSupport = safeNumber(civilization.warSupport);
  }
}
