import { bootstrapCivilizationState, GameState, worldYear } from "../app/GameState";
import { TERRITORY } from "../config/balanceConfig";
import { BuildingType } from "../entities/Building";
import { Civilization, CivilizationGoal, Settlement, SettlementPriority } from "../entities/Civilization";
import { ResourceStore } from "../entities/Resources";
import { clamp } from "../utils/MathUtils";
import { getTile, tileIndex } from "../world/World";
import { addEvent } from "./EventSystem";
import { economyMultiplier } from "./TechnologySystem";

const CIVILIZATION_TITLES = ["Kamp", "Gehucht", "Dorp", "Stad", "Hoofdstad", "Koninkrijk", "Regionale macht", "Groot rijk"] as const;

export function updateCivilization(state: GameState, dt: number): void {
  bootstrapCivilizationState(state);
  syncSettlementAssignments(state);
  syncSettlementAggregates(state);
  syncCivilizationAggregates(state);
  updateTerritory(state, dt);
  updateLegacyCivilizationSummary(state, dt);
}

export function forceTerritoryRefresh(state: GameState): void {
  state.territory.dirty = true;
  state.territory.recalculationTimer = 0;
}

function updateLegacyCivilizationSummary(state: GameState, dt: number): void {
  const completed = completedCounts(state);
  const completedBuildings = state.buildings.filter((building) => building.status === "complete").length;
  const primary = state.civilizations[0];
  const score =
    (primary?.population ?? state.villagers.length) / 2 +
    completedBuildings * 2 +
    (primary?.prosperity ?? state.civilization.prosperity) / 18 +
    (primary?.technologicalStrength ?? state.civilization.knowledge) / 20 +
    state.civilization.culture / 24;
  const nextLevel = score >= 110 ? 7 : score >= 80 ? 6 : score >= 55 ? 5 : score >= 42 ? 4 : score >= 30 ? 3 : score >= 19 ? 2 : score >= 11 ? 1 : 0;

  state.civilization.prosperity = Math.min(
    100,
    state.civilization.prosperity +
      dt * (completed.market * 0.05 + completed.storage * 0.015 + completed.farm * 0.012 + completed.house * 0.008)
  );
  state.civilization.knowledge = Math.min(
    100,
    state.civilization.knowledge + dt * (completed.school * 0.065 + completed.workshop * 0.025 + completed.mine * 0.012)
  );
  state.civilization.culture = Math.min(
    100,
    state.civilization.culture + dt * (completed.monument * 0.08 + completed.watchtower * 0.018 + completed.market * 0.01)
  );

  if (nextLevel > state.civilization.level) {
    state.civilization.level = nextLevel;
    state.civilization.title = CIVILIZATION_TITLES[nextLevel];
    addEvent(state, `${state.world.name} groeide uit tot een ${state.civilization.title.toLowerCase()}.`);
  } else {
    state.civilization.title = CIVILIZATION_TITLES[state.civilization.level] ?? "Kamp";
  }

  state.civilization.nextGoal = nextCivilizationGoal(state, completed);

  if (completed.well > 0) {
    for (const villager of state.villagers) {
      villager.health = Math.min(100, villager.health + dt * 0.025);
    }
  }
  if (completed.market > 0 || completed.monument > 0) {
    const boost = dt * (completed.market * 0.018 + completed.monument * 0.02);
    for (const villager of state.villagers) {
      villager.happiness = Math.min(100, villager.happiness + boost);
    }
  }
}

function syncSettlementAssignments(state: GameState): void {
  const fallbackSettlement = state.settlements[0];
  if (!fallbackSettlement) return;
  for (const building of state.buildings) {
    if (building.settlementId && state.settlements.some((settlement) => settlement.id === building.settlementId)) continue;
    const settlement = nearestSettlement(state, building.x + building.width / 2, building.y + building.height / 2) ?? fallbackSettlement;
    building.settlementId = settlement.id;
    building.civilizationId = settlement.civilizationId;
  }
  for (const villager of state.villagers) {
    if (villager.settlementId && state.settlements.some((settlement) => settlement.id === villager.settlementId)) continue;
    const settlement = nearestSettlement(state, villager.x, villager.y) ?? fallbackSettlement;
    villager.settlementId = settlement.id;
    villager.civilizationId = settlement.civilizationId;
  }
}

function syncSettlementAggregates(state: GameState): void {
  for (const settlement of state.settlements) {
    const buildings = state.buildings.filter((building) => building.settlementId === settlement.id);
    const completed = buildings.filter((building) => building.status === "complete");
    const residents = state.villagers.filter((villager) => villager.settlementId === settlement.id);
    const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
    const averageHappiness =
      residents.reduce((sum, villager) => sum + villager.happiness, 0) / Math.max(1, residents.length);
    const counts = countBuildings(completed);
    const localPopulation = residents.length + settlement.abstractPopulation;

    settlement.buildingIds = buildings.map((building) => building.id);
    settlement.residentIds = residents.map((villager) => villager.id);
    settlement.population = Math.max(0, Math.round(localPopulation));
    settlement.housingCapacity = completed.reduce((sum, building) => sum + building.capacity, 0);
    settlement.foodProduction = (counts.farm * 16 + counts.market * 2) * economyMultiplier(civilization, "food");
    settlement.woodProduction = counts.woodcutter * 10 * economyMultiplier(civilization, "wood");
    settlement.stoneProduction = (counts.mine * 8 + counts.workshop * 1) * economyMultiplier(civilization, "stone");
    settlement.metalProduction = (counts.mine > 0 && state.civilization.knowledge > 40 ? counts.mine * 2 : 0) * economyMultiplier(civilization, "metal");
    settlement.scienceProduction =
      (counts.school * 7 + counts.workshop * 2 + settlement.population * 0.03) * economyMultiplier(civilization, "research");
    settlement.wealthProduction = (counts.market * 8 + counts.storage * 1 + counts.monument * 1.5) * economyMultiplier(civilization, "wealth");
    settlement.defense = counts.watchtower * 16 + counts.wall * 20 + (settlement.tier === "capital" ? 14 : 0);
    settlement.happiness = Math.round(averageHappiness);
    settlement.foodSecurity = Math.round(clamp(((state.resources.food + settlement.foodProduction) / Math.max(1, settlement.population * 0.75)) * 42, 0, 100));
    settlement.stability = Math.round(clamp((settlement.happiness + settlement.foodSecurity + settlement.defense * 0.6) / 2.6, 0, 100));
    settlement.localPriorities = settlementPriorities(settlement, state.resources);
    settlement.stockpile.food = state.resources.food;
    settlement.stockpile.wood = state.resources.wood;
    settlement.stockpile.stone = state.resources.stone;
    settlement.stockpile.research = settlement.scienceProduction;
    settlement.stockpile.wealth = Math.max(0, settlement.stockpile.wealth + settlement.wealthProduction * 0.02);
    settlement.nextProject = settlement.localPriorities[0] ? priorityLabel(settlement.localPriorities[0]) : undefined;
  }
}

function syncCivilizationAggregates(state: GameState): void {
  for (const civilization of state.civilizations) {
    const settlements = state.settlements.filter((settlement) => settlement.civilizationId === civilization.id);
    const population = settlements.reduce((sum, settlement) => sum + settlement.population, 0);
    const foodSecurity = average(settlements.map((settlement) => settlement.foodSecurity));
    const stability = average(settlements.map((settlement) => settlement.stability));
    const prosperity = average(settlements.map((settlement) => settlement.wealthProduction * 8 + settlement.happiness * 0.4));
    const economicStrength = settlements.reduce(
      (sum, settlement) => sum + settlement.foodProduction + settlement.woodProduction + settlement.stoneProduction + settlement.wealthProduction,
      0
    );
    const militaryStrength =
      settlements.reduce((sum, settlement) => sum + settlement.defense, 0) +
      state.armies.filter((army) => army.civilizationId === civilization.id).reduce((sum, army) => sum + army.strength, 0);

    civilization.settlementIds = settlements.map((settlement) => settlement.id);
    civilization.population = Math.round(population);
    civilization.foodSecurity = Math.round(foodSecurity);
    civilization.stability = Math.round(clamp(stability - Math.max(0, settlements.length - 3) * 2, 0, 100));
    civilization.prosperity = Math.round(clamp(prosperity, 0, 100));
    civilization.economicStrength = Math.round(economicStrength);
    civilization.militaryStrength = Math.round(militaryStrength);
    civilization.technologicalStrength = Math.round(clamp(civilization.unlockedTechnologyIds.length * 12 + civilization.storedResearch * 0.05, 0, 100));
    civilization.treasury = Math.max(0, civilization.treasury + settlements.reduce((sum, settlement) => sum + settlement.wealthProduction, 0) * 0.015);
    civilization.strategicGoals = civilizationGoals(civilization, settlements);
  }
}

function updateTerritory(state: GameState, dt: number): void {
  state.territory.recalculationTimer -= dt;
  if (!state.territory.dirty && state.territory.recalculationTimer > 0) return;
  state.territory.recalculationTimer = 40;
  state.territory.dirty = false;
  state.territory.version += 1;
  if (state.territory.ownerByTile.length !== state.world.width * state.world.height) {
    state.territory.ownerByTile = Array.from({ length: state.world.width * state.world.height }, () => null);
  }

  for (const tile of state.world.tiles) {
    if (tile.type === "deepWater" || tile.type === "water" || tile.type === "mountain") {
      state.territory.ownerByTile[tileIndex(state.world, tile.x, tile.y)] = null;
      continue;
    }
    let bestCivilizationId: string | null = null;
    let bestInfluence = 0;
    let secondInfluence = 0;

    for (const settlement of state.settlements) {
      const d = Math.hypot(tile.x - settlement.centerX, tile.y - settlement.centerY);
      const influence =
        TERRITORY.baseSettlementInfluence +
        tierRank(settlement.tier) * TERRITORY.tierInfluence +
        settlement.population / TERRITORY.populationDivisor -
        d * (tile.type === "forest" ? 0.42 : tile.type === "rock" ? 0.5 : 0.36);
      if (influence > bestInfluence) {
        secondInfluence = bestInfluence;
        bestInfluence = influence;
        bestCivilizationId = settlement.civilizationId;
      } else if (influence > secondInfluence) {
        secondInfluence = influence;
      }
    }

    const owner = bestInfluence >= TERRITORY.dominanceThreshold && bestInfluence - secondInfluence > 1.2 ? bestCivilizationId : null;
    state.territory.ownerByTile[tileIndex(state.world, tile.x, tile.y)] = owner;
  }
}

function nearestSettlement(state: GameState, x: number, y: number): Settlement | undefined {
  return state.settlements
    .slice()
    .sort((a, b) => Math.hypot(a.centerX - x, a.centerY - y) - Math.hypot(b.centerX - x, b.centerY - y))[0];
}

function settlementPriorities(settlement: Settlement, resources: ResourceStore): SettlementPriority[] {
  const priorities: SettlementPriority[] = [];
  if (settlement.foodSecurity < 52 || resources.food < settlement.population * 3) priorities.push("food");
  if (settlement.housingCapacity < settlement.population + 4) priorities.push("housing");
  if (resources.wood < 24) priorities.push("wood");
  if (resources.stone < 12) priorities.push("stone");
  if (settlement.defense < 18 && settlement.population > 30) priorities.push("defense");
  if (settlement.wealthProduction < 5 && settlement.population > 18) priorities.push("wealth");
  if (settlement.scienceProduction < 5 && settlement.population > 24) priorities.push("science");
  if (settlement.connectedSettlementIds.length === 0 && settlement.population > 45) priorities.push("infrastructure");
  return priorities.length > 0 ? priorities : ["food"];
}

function civilizationGoals(civilization: Civilization, settlements: Settlement[]): CivilizationGoal[] {
  const goals: CivilizationGoal[] = [];
  if (civilization.foodSecurity < 55) goals.push("secureFood");
  if (settlements.some((settlement) => settlement.housingCapacity < settlement.population + 2)) goals.push("buildHousing");
  if (civilization.population > 30 && settlements.length < 2) goals.push("expandTerritory");
  if (civilization.technologicalStrength < 45) goals.push("research");
  if (civilization.prosperity > 35) goals.push("seekTrade");
  if (civilization.warSupport > 55) goals.push("mobilizeArmy");
  if (civilization.stability < 48) goals.push("stabilize");
  return goals.length > 0 ? goals : ["secureFood"];
}

function priorityLabel(priority: SettlementPriority): string {
  switch (priority) {
    case "food":
      return "meer voedsel";
    case "housing":
      return "meer woningen";
    case "wood":
      return "houtvoorraad";
    case "stone":
      return "steenvoorraad";
    case "defense":
      return "verdediging";
    case "wealth":
      return "welvaart";
    case "science":
      return "onderzoek";
    case "infrastructure":
      return "verbindingen";
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function tierRank(tier: Settlement["tier"]): number {
  switch (tier) {
    case "capital":
      return 5;
    case "city":
      return 4;
    case "town":
      return 3;
    case "village":
      return 2;
    case "hamlet":
      return 1;
    case "camp":
      return 0;
  }
}

function nextCivilizationGoal(state: GameState, completed: Record<BuildingType, number>): string {
  const primary = state.civilizations[0];
  const settlement = primary ? state.settlements.find((item) => item.id === primary.capitalSettlementId) : undefined;
  if (settlement?.nextProject) return settlement.nextProject;
  const bedCapacity = state.buildings
    .filter((building) => building.status === "complete" && building.type === "house")
    .reduce((sum, building) => sum + building.capacity, 0);
  if (completed.mine < 1) return "bouw een mijn";
  if (bedCapacity < state.villagers.length + 2) return "bouw meer huizen";
  if (completed.farm < Math.max(1, Math.ceil(state.villagers.length / 7))) return "leg meer boerderijen aan";
  if (completed.woodcutter < 1) return "bouw een houthakkershut";
  if (completed.well < 1) return "bouw een waterput";
  if (completed.workshop < 1) return "bouw een werkplaats";
  if (completed.market < 1) return "open een markt";
  if (completed.school < 1) return "bouw een school";
  if (completed.monument < 1) return "richt een monument op";
  return "laat de stad verder groeien";
}

function completedCounts(state: GameState): Record<BuildingType, number> {
  const counts: Record<BuildingType, number> = {
    campfire: 0,
    storage: 0,
    house: 0,
    woodcutter: 0,
    mine: 0,
    farm: 0,
    workshop: 0,
    watchtower: 0,
    well: 0,
    market: 0,
    school: 0,
    monument: 0
  };
  for (const building of state.buildings) {
    if (building.status === "complete") counts[building.type] += 1;
  }
  return counts;
}

function countBuildings(buildings: { type: BuildingType }[]): Record<BuildingType | "wall", number> {
  const counts: Record<BuildingType | "wall", number> = {
    campfire: 0,
    storage: 0,
    house: 0,
    woodcutter: 0,
    mine: 0,
    farm: 0,
    workshop: 0,
    watchtower: 0,
    well: 0,
    market: 0,
    school: 0,
    monument: 0,
    wall: 0
  };
  for (const building of buildings) counts[building.type] += 1;
  return counts;
}
