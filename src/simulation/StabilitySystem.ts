import { GameState, worldYear } from "../app/GameState";
import { CIVILIZATION_PREFIXES, CIVILIZATION_SUFFIXES } from "../config/civilizationConfig";
import { STABILITY } from "../config/stabilityConfig";
import { RECOVERY } from "../config/recoveryConfig";
import { Civilization, DiplomaticRelation, Settlement, War, createSettlementRecovery } from "../entities/Civilization";
import { clamp } from "../utils/MathUtils";
import { forceTerritoryRefresh } from "./CivilizationSystem";
import { addEvent } from "./EventSystem";
import { igniteTile } from "./FireSystem";
import { addHistoricalEvent } from "./HistorySystem";

export function updateStability(state: GameState, dt: number): void {
  state.civilizationTimers.history -= dt;
  if (state.civilizationTimers.history > 0) return;
  state.civilizationTimers.history = STABILITY.updateInterval;
  for (const civilization of [...state.civilizations]) {
    applyStabilityPressure(state, civilization);
    if (civilization.population <= 0 || (civilization.stability <= STABILITY.collapseThreshold && civilization.population < 8)) {
      collapseCivilization(state, civilization, "bestuurlijke instorting");
    }
  }
}

export function calculateUnrest(state: GameState, civilization: Civilization, settlement: Settlement): number {
  const activeWarExhaustion = activeWarsFor(state, civilization.id).reduce((sum, war) => sum + (war.exhaustionByCivilizationId[civilization.id] ?? 0), 0);
  const administrativePressure =
    Math.max(0, civilization.settlementIds.length - STABILITY.administrativeSettlementLimit) * STABILITY.administrativePressurePerSettlement;
  const hungerPressure = Math.max(0, 56 - settlement.foodSecurity) * STABILITY.hungerWeight;
  const housingPressure = Math.max(0, settlement.population + 2 - settlement.housingCapacity) * STABILITY.housingWeight;
  const happinessPressure = Math.max(0, 58 - settlement.happiness) * STABILITY.lowHappinessWeight;
  const exhaustionPressure = activeWarExhaustion * STABILITY.exhaustionWeight;
  const capitalRelief = civilization.capitalSettlementId === settlement.id ? 8 : 0;
  return clamp(100 - settlement.stability + administrativePressure + hungerPressure + housingPressure + happinessPressure + exhaustionPressure - capitalRelief, 0, 140);
}

export function applyStabilityPressure(state: GameState, civilization: Civilization): void {
  const settlements = state.settlements.filter((settlement) => settlement.civilizationId === civilization.id);
  let totalUnrest = 0;
  for (const settlement of settlements) {
    const unrest = calculateUnrest(state, civilization, settlement);
    totalUnrest += unrest;
    if (unrest < STABILITY.unrestWarning) {
      recoverStability(state, civilization, settlement);
      continue;
    }
    settlement.stability = clamp(settlement.stability - STABILITY.unrestDamage * (unrest / 100), 0, 100);
    for (const villager of state.villagers.filter((item) => item.settlementId === settlement.id)) {
      villager.happiness = clamp(villager.happiness - unrest * 0.025, 0, 100);
      if (unrest > STABILITY.rebellionThreshold && state.rng.chance(0.12)) villager.speech = "onrust";
    }
    if (unrest > STABILITY.rebellionThreshold && state.rng.chance(Math.min(0.32, (unrest - STABILITY.rebellionThreshold) / 100))) {
      triggerRiot(state, settlement, unrest);
    }
    if (unrest > STABILITY.secessionThreshold && settlements.length > 1 && state.civilizations.length < STABILITY.maxCivilizations) {
      triggerSecession(state, settlement, "onrust en afstand tot de hoofdstad");
    }
  }
  civilization.stability = clamp(civilization.stability - Math.max(0, totalUnrest / Math.max(1, settlements.length) - 62) * 0.08, 0, 100);
}

export function triggerSecession(state: GameState, settlement: Settlement, reason: string): Civilization | undefined {
  const former = state.civilizations.find((civilization) => civilization.id === settlement.civilizationId);
  if (!former || state.civilizations.length >= STABILITY.maxCivilizations) return undefined;
  const rebelId = state.ids.next("civilization");
  const year = worldYear(state);
  const name = uniqueCivilizationName(state, `${settlement.name} Vrijbond`);
  const rebel: Civilization = {
    id: rebelId,
    name,
    colorIndex: (former.colorIndex + 3 + state.rng.int(0, 3)) % 8,
    foundedYear: year,
    government: "chiefdom",
    traits: former.traits.slice(0, 1),
    capitalSettlementId: settlement.id,
    settlementIds: [settlement.id],
    population: settlement.population,
    militaryStrength: settlement.defense,
    economicStrength: settlement.foodProduction + settlement.woodProduction + settlement.stoneProduction + settlement.wealthProduction,
    technologicalStrength: former.technologicalStrength * 0.8,
    treasury: Math.max(0, former.treasury * 0.18),
    storedResearch: Math.max(0, former.storedResearch * 0.2),
    stability: 52,
    warSupport: 64,
    prosperity: settlement.wealthProduction,
    foodSecurity: settlement.foodSecurity,
    knownCivilizationIds: [former.id],
    activeWarIds: [],
    activeTreatyIds: [],
    unlockedTechnologyIds: former.unlockedTechnologyIds.slice(0, Math.max(3, former.unlockedTechnologyIds.length - 1)),
    currentResearchId: former.currentResearchId,
    strategicGoals: ["defendBorders", "stabilize"]
  };
  former.treasury = Math.max(0, former.treasury - rebel.treasury);
  settlement.civilizationId = rebelId;
  settlement.stability = 44;
  settlement.happiness = clamp(settlement.happiness - 18, 0, 100);
  settlement.connectedSettlementIds = [];
  for (const building of state.buildings) {
    if (building.settlementId === settlement.id) building.civilizationId = rebelId;
  }
  for (const villager of state.villagers) {
    if (villager.settlementId === settlement.id) {
      villager.civilizationId = rebelId;
      villager.happiness = clamp(villager.happiness - 12, 0, 100);
    }
  }
  state.civilizations.push(rebel);
  createIndependenceWar(state, rebel, former, settlement);
  forceTerritoryRefresh(state);
  addHistoricalEvent(state, "rebellion", `${settlement.name} scheidde zich af van ${former.name}: ${reason}.`, {
    civilizationId: rebel.id,
    settlementId: settlement.id,
    x: settlement.centerX,
    y: settlement.centerY
  });
  addEvent(state, `${settlement.name} komt in opstand en vormt ${rebel.name}.`);
  return rebel;
}

export function collapseCivilization(state: GameState, civilization: Civilization, reason: string): void {
  const settlements = state.settlements.filter((settlement) => settlement.civilizationId === civilization.id);
  if (state.civilizations.length <= 1 && settlements.length > 0) return;
  for (const war of state.wars) {
    if (!war.active) continue;
    if (war.attackerCivilizationIds.includes(civilization.id) || war.defenderCivilizationIds.includes(civilization.id)) war.active = false;
  }
  for (const settlement of settlements) {
    settlement.stability = 0;
    settlement.happiness = 0;
    const casualties = Math.min(settlement.population, Math.max(1, Math.round(settlement.population * 0.2)));
    removeSettlementPopulation(state, settlement, casualties);
    for (const building of state.buildings.filter((item) => item.settlementId === settlement.id)) {
      building.health = Math.min(building.health, 22);
      if (state.rng.chance(0.18)) igniteTile(state, building.x, building.y, 0.7);
    }
  }
  state.civilizations = state.civilizations.filter((item) => item.id !== civilization.id);
  state.armies = state.armies.filter((army) => army.civilizationId !== civilization.id);
  state.tradeRoutes = state.tradeRoutes.filter((route) => route.civilizationAId !== civilization.id && route.civilizationBId !== civilization.id);
  state.diplomaticRelations = state.diplomaticRelations.filter(
    (relation) => relation.civilizationAId !== civilization.id && relation.civilizationBId !== civilization.id
  );
  forceTerritoryRefresh(state);
  addHistoricalEvent(state, "civilizationCollapsed", `${civilization.name} stortten in door ${reason}.`, {
    civilizationId: civilization.id
  });
  addEvent(state, `${civilization.name} zijn ingestort.`);
}

export function triggerRiot(state: GameState, settlement: Settlement, unrest: number): void {
  const casualties = unrest > 100 ? Math.max(1, Math.round(settlement.population * 0.04)) : 0;
  if (casualties > 0) removeSettlementPopulation(state, settlement, casualties);
  const vulnerableBuilding = state.buildings.find(
    (building) => building.settlementId === settlement.id && (building.type === "market" || building.type === "storage" || building.type === "house")
  );
  if (vulnerableBuilding) {
    vulnerableBuilding.health = Math.max(8, vulnerableBuilding.health - unrest * 0.35);
    if (unrest > 92) igniteTile(state, vulnerableBuilding.x, vulnerableBuilding.y, 0.65);
  }
  const recovery = settlement.recovery ?? (settlement.recovery = createSettlementRecovery());
  recovery.recentCrisisTimer = Math.max(recovery.recentCrisisTimer, RECOVERY.recentCrisisDuration);
  recovery.state = "emergency";
  const recentRiot = state.historicEvents.some(
    (event) =>
      event.type === "rebellion" &&
      event.settlementId === settlement.id &&
      event.year >= worldYear(state) - 2
  );
  if (!recentRiot) {
    addHistoricalEvent(state, "rebellion", `${settlement.name} kende rellen door voedseltekort en onvrede.`, {
      civilizationId: settlement.civilizationId,
      settlementId: settlement.id,
      x: settlement.centerX,
      y: settlement.centerY
    });
  }
}

function recoverStability(state: GameState, civilization: Civilization, settlement: Settlement): void {
  const recovery = settlement.recovery;
  const activeFire = state.fires.some(
    (fire) => Math.hypot(fire.x - settlement.centerX, fire.y - settlement.centerY) < 24
  );
  const activeWar = activeWarsFor(state, civilization.id).length > 0;
  const healthy =
    settlement.foodSecurity >= 58 &&
    settlement.housingCapacity >= settlement.population &&
    settlement.foodProduction > 0 &&
    !activeFire &&
    !activeWar;
  if (!healthy) return;
  const crisisPenalty = recovery && recovery.recentCrisisTimer > 0 ? 0.35 : 1;
  const recoveryBonus = recovery?.state === "recovering" ? 1.25 : 1;
  settlement.stability = clamp(
    settlement.stability + RECOVERY.recoveryStabilityGain * crisisPenalty * recoveryBonus,
    0,
    100
  );
}

function createIndependenceWar(state: GameState, rebel: Civilization, former: Civilization, settlement: Settlement): War {
  const war: War = {
    id: state.ids.next("war"),
    attackerCivilizationIds: [rebel.id],
    defenderCivilizationIds: [former.id],
    startedYear: worldYear(state),
    goal: "independence",
    occupationPolicy: "annex",
    targetSettlementId: settlement.id,
    attackerWarScore: 0,
    defenderWarScore: 0,
    casualties: 0,
    occupiedSettlementIds: [],
    exhaustionByCivilizationId: { [rebel.id]: 12, [former.id]: 18 },
    active: true
  };
  rebel.activeWarIds.push(war.id);
  former.activeWarIds.push(war.id);
  state.wars.push(war);
  const relation: DiplomaticRelation = {
    civilizationAId: rebel.id,
    civilizationBId: former.id,
    opinionAOfB: -72,
    opinionBOfA: -68,
    trust: 0,
    fear: 18,
    tradeValue: 0,
    status: "atWar",
    grievances: [{ label: "afscheiding", value: 42, expiresYear: worldYear(state) + 120 }],
    positiveModifiers: []
  };
  state.diplomaticRelations.push(relation);
  return war;
}

function activeWarsFor(state: GameState, civilizationId: string): War[] {
  return state.wars.filter((war) => war.active && (war.attackerCivilizationIds.includes(civilizationId) || war.defenderCivilizationIds.includes(civilizationId)));
}

function removeSettlementPopulation(state: GameState, settlement: Settlement, losses: number): void {
  let remaining = losses;
  const residents = state.villagers.filter((villager) => villager.settlementId === settlement.id).slice(0, remaining);
  const residentIds = new Set(residents.map((villager) => villager.id));
  state.villagers = state.villagers.filter((villager) => !residentIds.has(villager.id));
  remaining -= residents.length;
  settlement.abstractPopulation = Math.max(0, settlement.abstractPopulation - remaining);
}

function uniqueCivilizationName(state: GameState, preferred: string): string {
  const fallback = `${state.rng.pick(CIVILIZATION_PREFIXES)} ${state.rng.pick(CIVILIZATION_SUFFIXES)}`;
  const base = preferred.length <= 26 ? preferred : fallback;
  const existing = state.civilizations.map((civilization) => civilization.name);
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}
