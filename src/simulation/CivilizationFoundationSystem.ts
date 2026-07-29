import { assignJobByIndex } from "../ai/Jobs";
import { createBuildingAt, GameState, worldYear } from "../app/GameState";
import { MIN_SETTLEMENT_DISTANCE_TILES } from "../config/balanceConfig";
import {
  CIVILIZATION_PREFIXES,
  CIVILIZATION_SUFFIXES,
  CIVILIZATION_TRAITS,
  SETTLEMENT_PREFIXES,
  SETTLEMENT_SUFFIXES
} from "../config/civilizationConfig";
import { Civilization, createSettlementRecovery, Settlement } from "../entities/Civilization";
import { createVillager, villagerName } from "../entities/Villager";
import { Point } from "../utils/MathUtils";
import { isWalkableTile } from "../world/Tile";
import { getTile } from "../world/World";
import { forceTerritoryRefresh } from "./CivilizationSystem";
import { addHistoricalEvent } from "./HistorySystem";
import { isValidBuildingSpot } from "./SettlementPlanner";

export interface CivilizationFoundationResult {
  founded: boolean;
  civilization?: Civilization;
  settlement?: Settlement;
  reason?: string;
}

export function foundIndependentCivilizationAt(
  state: GameState,
  requestedX: number,
  requestedY: number
): CivilizationFoundationResult {
  const site = findFoundationSite(state, requestedX, requestedY);
  if (!site) {
    return {
      founded: false,
      reason: "Kies een ruim stuk land, minstens enkele tientallen tegels van een bestaande nederzetting."
    };
  }

  const civilizationId = state.ids.next("civilization");
  const settlementId = state.ids.next("settlement");
  const civilizationName = uniqueName(
    `${state.rng.pick(CIVILIZATION_PREFIXES)} ${state.rng.pick(CIVILIZATION_SUFFIXES)}`,
    state.civilizations.map((civilization) => civilization.name)
  );
  const settlementName = uniqueName(
    `${state.rng.pick(SETTLEMENT_PREFIXES)}${state.rng.pick(SETTLEMENT_SUFFIXES)}`,
    state.settlements.map((settlement) => settlement.name)
  );
  const firstTrait = state.rng.pick(CIVILIZATION_TRAITS);
  const remainingTraits = CIVILIZATION_TRAITS.filter((trait) => trait !== firstTrait);
  const traits = state.rng.chance(0.55) ? [firstTrait, state.rng.pick(remainingTraits)] : [firstTrait];
  const campfire = createBuildingAt(state, "campfire", site.x - 1, site.y - 1, true);
  const storage = createBuildingAt(state, "storage", site.x + 2, site.y - 1, true);
  campfire.civilizationId = civilizationId;
  campfire.settlementId = settlementId;
  storage.civilizationId = civilizationId;
  storage.settlementId = settlementId;

  const residentIds: string[] = [];
  const usedSpawns: Point[] = [];
  for (let index = 0; index < 5; index += 1) {
    const spawn = findResidentSpawn(state, site, usedSpawns) ?? { x: site.x, y: site.y + 2 + index };
    usedSpawns.push(spawn);
    const villagerIndex = state.villagers.length;
    const villager = createVillager(
      state.ids.next("villager"),
      villagerName(villagerIndex),
      spawn.x + 0.5,
      spawn.y + 0.5,
      assignJobByIndex(villagerIndex),
      state.rng.int(18, 44)
    );
    villager.civilizationId = civilizationId;
    villager.settlementId = settlementId;
    state.villagers.push(villager);
    residentIds.push(villager.id);
  }

  const settlement: Settlement = {
    id: settlementId,
    civilizationId,
    name: settlementName,
    centerX: site.x,
    centerY: site.y,
    foundedYear: worldYear(state),
    tier: "camp",
    population: residentIds.length,
    abstractPopulation: 0,
    housingCapacity: 0,
    foodProduction: 0,
    woodProduction: 0,
    stoneProduction: 0,
    metalProduction: 0,
    scienceProduction: 0,
    wealthProduction: 0,
    happiness: 68,
    stability: 72,
    defense: 0,
    foodSecurity: 48,
    buildingIds: [campfire.id, storage.id],
    residentIds,
    connectedSettlementIds: [],
    localPriorities: ["housing", "food", "wood"],
    stockpile: { food: 30, wood: 16, stone: 0, metal: 0, tools: 0, wealth: 0, research: 0 },
    nextProject: "bouw het eerste huis",
    recovery: createSettlementRecovery()
  };
  const usedColors = new Set(state.civilizations.map((civilization) => civilization.colorIndex));
  const availableColors = Array.from({ length: 8 }, (_, index) => index).filter((index) => !usedColors.has(index));
  const colorIndex = availableColors.length > 0 ? state.rng.pick(availableColors) : state.rng.int(0, 7);
  const civilization: Civilization = {
    id: civilizationId,
    name: civilizationName,
    colorIndex,
    foundedYear: worldYear(state),
    government: "tribe",
    traits,
    capitalSettlementId: settlementId,
    settlementIds: [settlementId],
    population: residentIds.length,
    militaryStrength: 0,
    economicStrength: 0,
    technologicalStrength: 0,
    treasury: 0,
    storedResearch: 0,
    stability: settlement.stability,
    warSupport: traits.includes("militaristic") ? 45 : 24,
    prosperity: 0,
    foodSecurity: settlement.foodSecurity,
    knownCivilizationIds: [],
    activeWarIds: [],
    activeTreatyIds: [],
    unlockedTechnologyIds: ["fire", "gathering", "shelter"],
    currentResearchId: "agriculture",
    strategicGoals: ["secureFood", "buildHousing"]
  };

  state.settlements.push(settlement);
  state.civilizations.push(civilization);
  state.selectedCivilizationId = civilization.id;
  state.selected = { kind: "settlement", id: settlement.id };
  forceTerritoryRefresh(state);
  addHistoricalEvent(state, "civilizationFounded", `${civilization.name} ontstonden rond ${settlement.name}.`, {
    civilizationId: civilization.id,
    settlementId: settlement.id,
    x: settlement.centerX,
    y: settlement.centerY
  });
  return { founded: true, civilization, settlement };
}

export function findFoundationSite(state: GameState, requestedX: number, requestedY: number): Point | undefined {
  for (let radius = 0; radius <= 8; radius += 1) {
    for (let y = requestedY - radius; y <= requestedY + radius; y += 1) {
      for (let x = requestedX - radius; x <= requestedX + radius; x += 1) {
        if (radius > 0 && x !== requestedX - radius && x !== requestedX + radius && y !== requestedY - radius && y !== requestedY + radius) {
          continue;
        }
        if (isFoundationSiteValid(state, x, y)) return { x, y };
      }
    }
  }
  return undefined;
}

function isFoundationSiteValid(state: GameState, x: number, y: number): boolean {
  const tile = getTile(state.world, x, y);
  if (!tile || !isWalkableTile(tile) || tile.occupiedByBuildingId || tile.type === "rock" || tile.type === "road") return false;
  if (
    state.settlements.some(
      (settlement) => Math.hypot(settlement.centerX - x, settlement.centerY - y) < MIN_SETTLEMENT_DISTANCE_TILES
    )
  ) {
    return false;
  }
  if (!isValidBuildingSpot(state, x - 1, y - 1, "campfire")) return false;
  if (!isValidBuildingSpot(state, x + 2, y - 1, "storage")) return false;
  let buildable = 0;
  let foodOrForest = 0;
  for (let yy = y - 5; yy <= y + 5; yy += 1) {
    for (let xx = x - 5; xx <= x + 5; xx += 1) {
      const nearby = getTile(state.world, xx, yy);
      if (!nearby) continue;
      if (isWalkableTile(nearby) && !nearby.occupiedByBuildingId && nearby.type !== "rock") buildable += 1;
      if (nearby.type === "forest" || ((nearby.type === "grass" || nearby.type === "farmland") && nearby.resourceAmount > 0)) {
        foodOrForest += 1;
      }
    }
  }
  return buildable >= 52 && foodOrForest >= 4;
}

function findResidentSpawn(state: GameState, center: Point, used: Point[]): Point | undefined {
  for (let radius = 2; radius <= 6; radius += 1) {
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        const tile = getTile(state.world, x, y);
        if (!tile || !isWalkableTile(tile) || tile.occupiedByBuildingId) continue;
        if (used.some((point) => point.x === x && point.y === y)) continue;
        return { x, y };
      }
    }
  }
  return undefined;
}

function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}
