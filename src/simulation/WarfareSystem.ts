import { GameState, worldYear } from "../app/GameState";
import { WARFARE } from "../config/warfareConfig";
import { Army, Civilization, Settlement, War, WarGoal } from "../entities/Civilization";
import { clamp, distance } from "../utils/MathUtils";
import { forceTerritoryRefresh } from "./CivilizationSystem";
import { getRelation } from "./DiplomacySystem";
import { addEvent } from "./EventSystem";
import { igniteTile } from "./FireSystem";
import { addHistoricalEvent } from "./HistorySystem";

export function updateWarfare(state: GameState, dt: number): void {
  normalizeWarState(state);
  updateArmies(state, dt);
  updateActiveWars(state, dt);
  state.civilizationTimers.war -= dt;
  if (state.civilizationTimers.war > 0) return;
  state.civilizationTimers.war = WARFARE.decisionInterval;
  evaluateWarDeclarations(state);
  evaluatePeace(state);
}

export function calculateWarDesirability(state: GameState, attacker: Civilization, defender: Civilization): number {
  if (attacker.id === defender.id || hasActiveWarBetween(state, attacker.id, defender.id)) return -100;
  const relation = getRelation(state, attacker.id, defender.id);
  if (!relation || relation.status === "unknown" || relation.status === "allied") return -40;
  const attackerOpinion = relation.civilizationAId === attacker.id ? relation.opinionAOfB : relation.opinionBOfA;
  const pair = closestSettlementPair(state, attacker, defender);
  if (!pair || pair.distance > 86) return -30;
  const contestedBorder = state.territory.ownerByTile.some((owner, index) => {
    if (owner !== attacker.id) return false;
    const x = index % state.world.width;
    const y = Math.floor(index / state.world.width);
    const nearbyDefender = state.settlements.some((settlement) => settlement.civilizationId === defender.id && Math.hypot(settlement.centerX - x, settlement.centerY - y) < 10);
    return nearbyDefender;
  });
  const strengthRatio = (attacker.militaryStrength + attacker.population * 0.2 + 1) / (defender.militaryStrength + defender.population * 0.2 + 1);
  const scarcityPressure = Math.max(0, 58 - attacker.foodSecurity) * 0.45 + Math.max(0, 42 - attacker.prosperity) * 0.2;
  const traitPressure = attacker.traits.includes("militaristic") ? 18 : attacker.traits.includes("isolationist") ? -12 : 0;
  const grievancePressure = relation.grievances.reduce((sum, grievance) => sum + Math.max(0, grievance.value), 0) * 0.35;
  const opportunity = clamp((strengthRatio - 0.75) * 32, -18, 28);
  const borderPressure = contestedBorder ? 12 : 0;
  return attacker.warSupport + traitPressure + scarcityPressure + grievancePressure + opportunity + borderPressure - attackerOpinion * 0.42;
}

export function mobilizeArmy(state: GameState, civilization: Civilization, target: Settlement, warId?: string, mode: Army["state"] = "moving"): Army | undefined {
  const origin = state.settlements.find((settlement) => settlement.id === civilization.capitalSettlementId) ?? state.settlements.find((settlement) => settlement.civilizationId === civilization.id);
  if (!origin) return undefined;
  const existingMobilized = state.armies.filter((army) => army.civilizationId === civilization.id && army.state !== "disbanding").reduce((sum, army) => sum + army.soldierIds.length, 0);
  const populationCap = Math.max(WARFARE.minimumArmySize, Math.floor(civilization.population * WARFARE.musterPopulationShare));
  const targetSize = Math.max(0, populationCap - existingMobilized);
  if (targetSize < WARFARE.minimumArmySize && mode !== "defending") return undefined;

  const availableVillagers = state.villagers.filter((villager) => villager.civilizationId === civilization.id && !villager.armyId && villager.health > 35);
  const soldierIds = availableVillagers.slice(0, targetSize).map((villager) => villager.id);
  while (soldierIds.length < targetSize) soldierIds.push(state.ids.next("levy"));
  if (soldierIds.length === 0) return undefined;

  const army: Army = {
    id: state.ids.next("army"),
    civilizationId: civilization.id,
    soldierIds,
    x: origin.centerX,
    y: origin.centerY,
    targetX: target.centerX,
    targetY: target.centerY,
    strength: soldierIds.length * WARFARE.strengthPerSoldier + origin.defense * 0.25,
    morale: clamp(WARFARE.moraleBase + civilization.warSupport * 0.18 + (mode === "defending" ? WARFARE.defensiveMoraleBonus : 0), 20, 100),
    supplies: WARFARE.baseSupply,
    state: mode,
    targetSettlementId: target.id,
    warId
  };
  state.armies.push(army);
  for (const villager of availableVillagers.slice(0, soldierIds.length)) {
    villager.armyId = army.id;
    villager.targetX = target.centerX;
    villager.targetY = target.centerY;
    villager.speech = mode === "defending" ? "wacht" : "ten strijde";
    villager.speechTimer = 2.4;
  }
  return army;
}

export function declareWar(state: GameState, attacker: Civilization, defender: Civilization, goal: WarGoal = "captureSettlement"): War | undefined {
  if (hasActiveWarBetween(state, attacker.id, defender.id)) return undefined;
  const target = chooseWarTarget(state, attacker, defender);
  if (!target) return undefined;
  const war: War = {
    id: state.ids.next("war"),
    attackerCivilizationIds: [attacker.id],
    defenderCivilizationIds: [defender.id],
    startedYear: worldYear(state),
    goal,
    targetSettlementId: target.id,
    attackerWarScore: 0,
    defenderWarScore: 0,
    casualties: 0,
    occupiedSettlementIds: [],
    exhaustionByCivilizationId: { [attacker.id]: 0, [defender.id]: 0 },
    active: true
  };
  state.wars.push(war);
  attacker.activeWarIds.push(war.id);
  defender.activeWarIds.push(war.id);
  attacker.warSupport = clamp(attacker.warSupport + 8, 0, 100);
  defender.warSupport = clamp(defender.warSupport + 12, 0, 100);
  const relation = getRelation(state, attacker.id, defender.id);
  if (relation) {
    relation.status = "atWar";
    relation.opinionAOfB = clamp(relation.opinionAOfB - 30, -100, 100);
    relation.opinionBOfA = clamp(relation.opinionBOfA - 30, -100, 100);
    relation.grievances.push({ label: "oorlogsverklaring", value: 25, expiresYear: worldYear(state) + 80 });
  }
  interruptTradeBetween(state, attacker.id, defender.id);
  mobilizeArmy(state, attacker, target, war.id, "moving");
  mobilizeArmy(state, defender, target, war.id, "defending");
  addHistoricalEvent(state, "warStarted", `${attacker.name} verklaarden oorlog aan ${defender.name} om ${target.name}.`, {
    civilizationId: attacker.id,
    settlementId: target.id,
    warId: war.id,
    x: target.centerX,
    y: target.centerY
  });
  addEvent(state, `${attacker.name} en ${defender.name} zijn in oorlog.`);
  return war;
}

export function resolveBattle(state: GameState, attacker: Army, defender: Army): "attacker" | "defender" {
  const attackerRoll = effectiveArmyStrength(state, attacker) * state.rng.float(1 - WARFARE.battleVariance, 1 + WARFARE.battleVariance);
  const defenderRoll = effectiveArmyStrength(state, defender) * state.rng.float(1 - WARFARE.battleVariance, 1 + WARFARE.battleVariance);
  const attackerLosses = Math.max(1, Math.round(defenderRoll / Math.max(8, attackerRoll + defenderRoll) * attacker.soldierIds.length * 0.55));
  const defenderLosses = Math.max(1, Math.round(attackerRoll / Math.max(8, attackerRoll + defenderRoll) * defender.soldierIds.length * 0.55));
  applyArmyCasualties(state, attacker, attackerLosses);
  applyArmyCasualties(state, defender, defenderLosses);
  attacker.morale = clamp(attacker.morale - attackerLosses * 2.4 + (attackerRoll > defenderRoll ? 7 : -6), 0, 100);
  defender.morale = clamp(defender.morale - defenderLosses * 2.4 + (defenderRoll >= attackerRoll ? 7 : -6), 0, 100);
  registerBattle(state, attacker, defender, attackerLosses + defenderLosses, attackerRoll > defenderRoll ? attacker.civilizationId : defender.civilizationId);
  cleanupSpentArmies(state);
  return attackerRoll > defenderRoll ? "attacker" : "defender";
}

export function evaluatePeace(state: GameState): void {
  for (const war of state.wars) {
    if (!war.active) continue;
    const age = worldYear(state) - war.startedYear;
    if (age < WARFARE.minimumWarDays) continue;
    const attackerExhaustion = average(war.attackerCivilizationIds.map((id) => war.exhaustionByCivilizationId[id] ?? 0));
    const defenderExhaustion = average(war.defenderCivilizationIds.map((id) => war.exhaustionByCivilizationId[id] ?? 0));
    const decisiveScore = Math.abs(war.attackerWarScore - war.defenderWarScore) > 46;
    if (attackerExhaustion < WARFARE.peaceExhaustionThreshold && defenderExhaustion < WARFARE.peaceExhaustionThreshold && !decisiveScore) continue;
    signPeace(state, war);
  }
}

function evaluateWarDeclarations(state: GameState): void {
  if (state.civilizations.length < 2 || worldYear(state) < 38) return;
  for (const attacker of state.civilizations) {
    for (const defender of state.civilizations) {
      if (attacker.id === defender.id) continue;
      const desirability = calculateWarDesirability(state, attacker, defender);
      if (desirability < 72) continue;
      if (!state.rng.chance(clamp((desirability - 68) / 80, 0.04, 0.38))) continue;
      declareWar(state, attacker, defender, desirability > 92 ? "resources" : "captureSettlement");
      return;
    }
  }
}

function updateArmies(state: GameState, dt: number): void {
  for (const army of state.armies) {
    army.supplies = clamp(army.supplies - WARFARE.supplyUsePerSecond * dt, 0, WARFARE.baseSupply);
    if (army.supplies <= 0) army.morale = clamp(army.morale - dt * 1.8, 0, 100);
    if (army.state === "defending") {
      const target = army.targetSettlementId ? state.settlements.find((settlement) => settlement.id === army.targetSettlementId) : undefined;
      if (target) {
        army.targetX = target.centerX;
        army.targetY = target.centerY;
        army.x += (target.centerX - army.x) * Math.min(1, dt * 0.25);
        army.y += (target.centerY - army.y) * Math.min(1, dt * 0.25);
      }
      continue;
    }
    if (army.state === "disbanding") continue;
    moveArmy(army, dt);
    const enemy = nearestEnemyArmy(state, army);
    if (enemy && distance(army, enemy) < 2.2) {
      resolveBattle(state, army, enemy);
      continue;
    }
    if (army.targetSettlementId && distance(army, { x: army.targetX, y: army.targetY }) <= WARFARE.siegeDistance) {
      army.state = "besieging";
      resolveSiege(state, army);
    }
  }
  cleanupSpentArmies(state);
}

function updateActiveWars(state: GameState, dt: number): void {
  for (const war of state.wars) {
    if (!war.active) continue;
    for (const civilizationId of [...war.attackerCivilizationIds, ...war.defenderCivilizationIds]) {
      war.exhaustionByCivilizationId[civilizationId] = clamp((war.exhaustionByCivilizationId[civilizationId] ?? 0) + WARFARE.exhaustionPerDay * (dt / 24), 0, 100);
    }
  }
}

function moveArmy(army: Army, dt: number): void {
  const dx = army.targetX - army.x;
  const dy = army.targetY - army.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.01) return;
  const step = Math.min(length, WARFARE.armySpeed * dt);
  army.x += (dx / length) * step;
  army.y += (dy / length) * step;
}

function resolveSiege(state: GameState, army: Army): void {
  const target = state.settlements.find((settlement) => settlement.id === army.targetSettlementId);
  if (!target || target.civilizationId === army.civilizationId) {
    army.state = "disbanding";
    return;
  }
  const war = army.warId ? state.wars.find((item) => item.id === army.warId) : undefined;
  const defendingArmies = state.armies.filter(
    (candidate) => candidate.id !== army.id && candidate.civilizationId === target.civilizationId && distance(candidate, settlementPoint(target)) < 5
  );
  for (const defender of defendingArmies) {
    const result = resolveBattle(state, army, defender);
    if (result === "defender" && army.soldierIds.length < WARFARE.minimumArmySize) return;
  }
  const defenderMilitia = Math.max(2, Math.round(target.population * 0.08));
  const defensiveStrength = target.defense + defenderMilitia * 3.8 + defendingArmies.reduce((sum, defender) => sum + effectiveArmyStrength(state, defender) * 0.2, 0);
  const attackerStrength = effectiveArmyStrength(state, army);
  if (attackerStrength <= defensiveStrength + WARFARE.captureThreshold) {
    const attackerLosses = Math.max(1, Math.round(defensiveStrength / Math.max(10, attackerStrength + defensiveStrength) * army.soldierIds.length * 0.45));
    applyArmyCasualties(state, army, attackerLosses);
    target.stability = clamp(target.stability - 6, 0, 100);
    if (war) {
      war.defenderWarScore += 8;
      war.exhaustionByCivilizationId[army.civilizationId] = clamp((war.exhaustionByCivilizationId[army.civilizationId] ?? 0) + attackerLosses * WARFARE.exhaustionPerCasualty, 0, 100);
    }
    army.state = army.soldierIds.length >= WARFARE.minimumArmySize ? "retreating" : "disbanding";
    army.targetX = state.settlements.find((settlement) => settlement.civilizationId === army.civilizationId)?.centerX ?? army.x;
    army.targetY = state.settlements.find((settlement) => settlement.civilizationId === army.civilizationId)?.centerY ?? army.y;
    return;
  }
  captureSettlement(state, army, target, war);
}

function captureSettlement(state: GameState, army: Army, target: Settlement, war: War | undefined): void {
  const previousCivilization = state.civilizations.find((civilization) => civilization.id === target.civilizationId);
  const newCivilization = state.civilizations.find((civilization) => civilization.id === army.civilizationId);
  if (!newCivilization || !previousCivilization) return;
  const civilianLosses = Math.min(Math.max(1, Math.round(target.population * state.rng.float(0.03, 0.12))), Math.max(1, target.population));
  removeSettlementPopulation(state, target, civilianLosses);
  target.civilizationId = newCivilization.id;
  target.stability = clamp(target.stability - 24, 0, 100);
  target.happiness = clamp(target.happiness - 18, 0, 100);
  target.connectedSettlementIds = target.connectedSettlementIds.filter((id) => state.settlements.some((settlement) => settlement.id === id && settlement.civilizationId === newCivilization.id));
  for (const building of state.buildings) {
    if (building.settlementId !== target.id) continue;
    building.civilizationId = newCivilization.id;
    if (state.rng.chance(WARFARE.raidFireChance) && (building.type === "house" || building.type === "storage" || building.type === "market")) {
      igniteTile(state, building.x, building.y, 0.9);
    }
  }
  for (const villager of state.villagers) {
    if (villager.settlementId !== target.id) continue;
    villager.civilizationId = newCivilization.id;
    villager.happiness = clamp(villager.happiness - 22, 0, 100);
  }
  if (previousCivilization.capitalSettlementId === target.id) {
    previousCivilization.capitalSettlementId = state.settlements.find((settlement) => settlement.civilizationId === previousCivilization.id)?.id ?? target.id;
  }
  if (war) {
    war.attackerWarScore += 28;
    war.occupiedSettlementIds.push(target.id);
    war.casualties += civilianLosses;
    war.exhaustionByCivilizationId[previousCivilization.id] = clamp((war.exhaustionByCivilizationId[previousCivilization.id] ?? 0) + 18 + civilianLosses * 0.8, 0, 100);
  }
  army.state = "defending";
  army.targetX = target.centerX;
  army.targetY = target.centerY;
  forceTerritoryRefresh(state);
  addHistoricalEvent(state, "settlementCaptured", `${newCivilization.name} veroverden ${target.name} op ${previousCivilization.name}.`, {
    civilizationId: newCivilization.id,
    settlementId: target.id,
    warId: war?.id,
    x: target.centerX,
    y: target.centerY
  });
  addEvent(state, `${target.name} is veroverd door ${newCivilization.name}.`);
}

function registerBattle(state: GameState, a: Army, b: Army, casualties: number, winnerId: string): void {
  const war = a.warId ? state.wars.find((item) => item.id === a.warId) : b.warId ? state.wars.find((item) => item.id === b.warId) : undefined;
  const winner = state.civilizations.find((civilization) => civilization.id === winnerId);
  if (war) {
    war.casualties += casualties;
    const winnerIsAttacker = war.attackerCivilizationIds.includes(winnerId);
    if (winnerIsAttacker) war.attackerWarScore += 10;
    else war.defenderWarScore += 10;
    for (const civilizationId of [a.civilizationId, b.civilizationId]) {
      war.exhaustionByCivilizationId[civilizationId] = clamp((war.exhaustionByCivilizationId[civilizationId] ?? 0) + casualties * WARFARE.exhaustionPerCasualty * 0.5, 0, 100);
    }
  }
  addHistoricalEvent(state, "battle", `${winner?.name ?? "Een leger"} won een veldslag met ${casualties} slachtoffers.`, {
    civilizationId: winnerId,
    warId: war?.id,
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  });
}

function signPeace(state: GameState, war: War): void {
  war.active = false;
  for (const civilizationId of [...war.attackerCivilizationIds, ...war.defenderCivilizationIds]) {
    const civilization = state.civilizations.find((item) => item.id === civilizationId);
    if (!civilization) continue;
    civilization.activeWarIds = civilization.activeWarIds.filter((id) => id !== war.id);
    civilization.warSupport = clamp(civilization.warSupport - 18, 0, 100);
  }
  for (const army of state.armies.filter((item) => item.warId === war.id)) army.state = "disbanding";
  const [attackerId] = war.attackerCivilizationIds;
  const [defenderId] = war.defenderCivilizationIds;
  const relation = getRelation(state, attackerId, defenderId);
  if (relation) {
    relation.status = "hostile";
    relation.trust = clamp(relation.trust - 18, -100, 100);
  }
  const attacker = state.civilizations.find((item) => item.id === attackerId);
  const defender = state.civilizations.find((item) => item.id === defenderId);
  addHistoricalEvent(state, "peaceSigned", `${attacker?.name ?? "Aanvallers"} en ${defender?.name ?? "verdedigers"} sloten vrede.`, {
    civilizationId: attackerId,
    warId: war.id
  });
  addEvent(state, `Er is vrede gesloten na een oorlog met ${war.casualties} slachtoffers.`);
}

function interruptTradeBetween(state: GameState, a: string, b: string): void {
  for (const route of state.tradeRoutes) {
    const connects = (route.civilizationAId === a && route.civilizationBId === b) || (route.civilizationAId === b && route.civilizationBId === a);
    if (!connects) continue;
    route.active = false;
  }
  for (const civilization of state.civilizations) {
    if (civilization.id !== a && civilization.id !== b) continue;
    civilization.activeTreatyIds = civilization.activeTreatyIds.filter((id) => state.tradeRoutes.some((route) => route.id === id && route.active));
  }
}

function cleanupSpentArmies(state: GameState): void {
  const activeArmyIds = new Set(state.armies.filter((army) => army.state !== "disbanding" && army.soldierIds.length > 0 && army.morale > 0).map((army) => army.id));
  for (const villager of state.villagers) {
    if (villager.armyId && !activeArmyIds.has(villager.armyId)) villager.armyId = undefined;
  }
  state.armies = state.armies.filter((army) => activeArmyIds.has(army.id));
}

function applyArmyCasualties(state: GameState, army: Army, requestedLosses: number): number {
  const losses = Math.min(army.soldierIds.length, Math.max(0, requestedLosses));
  if (losses === 0) return 0;
  const lostIds = new Set(army.soldierIds.slice(0, losses));
  army.soldierIds = army.soldierIds.filter((id) => !lostIds.has(id));
  const physicalLosses = state.villagers.filter((villager) => lostIds.has(villager.id));
  const physicalLossIds = new Set(physicalLosses.map((villager) => villager.id));
  state.villagers = state.villagers.filter((villager) => !physicalLossIds.has(villager.id));
  const abstractLosses = losses - physicalLosses.length;
  if (abstractLosses > 0) {
    const settlement = state.settlements.find((item) => item.civilizationId === army.civilizationId);
    if (settlement) settlement.abstractPopulation = Math.max(0, settlement.abstractPopulation - abstractLosses);
  }
  army.strength = Math.max(0, army.soldierIds.length * WARFARE.strengthPerSoldier * (army.supplies > 0 ? 1 : 0.72));
  return losses;
}

function removeSettlementPopulation(state: GameState, settlement: Settlement, losses: number): void {
  let remaining = losses;
  const residents = state.villagers.filter((villager) => villager.settlementId === settlement.id).slice(0, remaining);
  const residentIds = new Set(residents.map((villager) => villager.id));
  state.villagers = state.villagers.filter((villager) => !residentIds.has(villager.id));
  remaining -= residents.length;
  settlement.abstractPopulation = Math.max(0, settlement.abstractPopulation - remaining);
}

function effectiveArmyStrength(state: GameState, army: Army): number {
  const settlement = army.targetSettlementId ? state.settlements.find((item) => item.id === army.targetSettlementId) : undefined;
  const defensiveBonus = army.state === "defending" && settlement?.civilizationId === army.civilizationId ? settlement.defense * 0.35 : 0;
  return Math.max(1, army.strength * (0.55 + army.morale / 145) * (0.6 + army.supplies / 160) + defensiveBonus);
}

function chooseWarTarget(state: GameState, attacker: Civilization, defender: Civilization): Settlement | undefined {
  return state.settlements
    .filter((settlement) => settlement.civilizationId === defender.id)
    .sort((a, b) => {
      const attackerHome = state.settlements.find((settlement) => settlement.civilizationId === attacker.id);
      const da = attackerHome ? distance(settlementPoint(attackerHome), settlementPoint(a)) : 0;
      const db = attackerHome ? distance(settlementPoint(attackerHome), settlementPoint(b)) : 0;
      return da + a.defense * 0.35 - (db + b.defense * 0.35);
    })[0];
}

function closestSettlementPair(state: GameState, a: Civilization, b: Civilization): { a: Settlement; b: Settlement; distance: number } | undefined {
  let best: { a: Settlement; b: Settlement; distance: number } | undefined;
  for (const settlementA of state.settlements.filter((settlement) => settlement.civilizationId === a.id)) {
    for (const settlementB of state.settlements.filter((settlement) => settlement.civilizationId === b.id)) {
      const d = distance(settlementPoint(settlementA), settlementPoint(settlementB));
      if (!best || d < best.distance) best = { a: settlementA, b: settlementB, distance: d };
    }
  }
  return best;
}

function settlementPoint(settlement: Settlement): { x: number; y: number } {
  return { x: settlement.centerX, y: settlement.centerY };
}

function nearestEnemyArmy(state: GameState, army: Army): Army | undefined {
  const war = army.warId ? state.wars.find((item) => item.id === army.warId && item.active) : undefined;
  if (!war) return undefined;
  const enemies = war.attackerCivilizationIds.includes(army.civilizationId) ? war.defenderCivilizationIds : war.attackerCivilizationIds;
  return state.armies
    .filter((candidate) => candidate.id !== army.id && candidate.state !== "disbanding" && enemies.includes(candidate.civilizationId))
    .sort((a, b) => distance(army, a) - distance(army, b))[0];
}

function hasActiveWarBetween(state: GameState, a: string, b: string): boolean {
  return state.wars.some(
    (war) =>
      war.active &&
      ((war.attackerCivilizationIds.includes(a) && war.defenderCivilizationIds.includes(b)) ||
        (war.attackerCivilizationIds.includes(b) && war.defenderCivilizationIds.includes(a)))
  );
}

function normalizeWarState(state: GameState): void {
  for (const war of state.wars) {
    war.casualties = safeNumber(war.casualties);
    war.attackerWarScore = safeNumber(war.attackerWarScore);
    war.defenderWarScore = safeNumber(war.defenderWarScore);
    war.exhaustionByCivilizationId ??= {};
  }
  for (const army of state.armies) {
    army.strength = safeNumber(army.strength);
    army.morale = clamp(safeNumber(army.morale), 0, 100);
    army.supplies = clamp(safeNumber(army.supplies), 0, WARFARE.baseSupply);
  }
}

function safeNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
