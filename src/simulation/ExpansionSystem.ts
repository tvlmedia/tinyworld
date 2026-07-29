import { assignJobByIndex } from "../ai/Jobs";
import { GameState, worldYear, createBuildingAt } from "../app/GameState";
import { COLONIZATION, MIN_SETTLEMENT_DISTANCE_TILES, ROAD_NETWORK } from "../config/balanceConfig";
import { SETTLEMENT_PREFIXES, SETTLEMENT_SUFFIXES } from "../config/civilizationConfig";
import { SETTLEMENT_TIER_LABELS, SETTLEMENT_TIER_RULES } from "../config/settlementConfig";
import { Civilization, ColonistGroup, Settlement, SettlementTier } from "../entities/Civilization";
import { createVillager, villagerName } from "../entities/Villager";
import { Point, clamp } from "../utils/MathUtils";
import { isWalkableTile, isWater } from "../world/Tile";
import { getTile } from "../world/World";
import { forceTerritoryRefresh } from "./CivilizationSystem";
import { addHistoricalEvent } from "./HistorySystem";

export function updateExpansion(state: GameState, dt: number): void {
  updateSettlementTiers(state);
  updateColonistGroups(state, dt);
  updateMigrationGroups(state, dt);
  state.civilizationTimers.settlementEconomy -= dt;
  if (state.civilizationTimers.settlementEconomy <= 0) {
    state.civilizationTimers.settlementEconomy = 18;
    updateMacroPopulation(state);
  }
  state.civilizationTimers.civilizationStrategy -= dt;
  if (state.civilizationTimers.civilizationStrategy > 0) return;
  state.civilizationTimers.civilizationStrategy = 72;
  maintainRoadNetworks(state);
  maybePlanColonization(state);
  maybeCreateMigration(state);
}

function updateMacroPopulation(state: GameState): void {
  for (const settlement of state.settlements) {
    const freeHousing = Math.max(0, settlement.housingCapacity - settlement.population);
    if (settlement.foodSecurity > 62 && settlement.happiness > 54 && freeHousing > 0) {
      const growth = Math.min(freeHousing, settlement.tier === "camp" ? 1 : settlement.tier === "hamlet" ? 2 : 3);
      settlement.abstractPopulation += growth;
      settlement.stockpile.food = Math.max(0, settlement.stockpile.food - growth * 1.5);
    } else if (settlement.foodSecurity < 22 && settlement.abstractPopulation > 0) {
      settlement.abstractPopulation = Math.max(0, settlement.abstractPopulation - 1);
      settlement.happiness = Math.max(0, settlement.happiness - 4);
    }
  }
}

export function scoreExpansionLocation(state: GameState, civilization: Civilization, origin: Settlement, point: Point): number {
  const tile = getTile(state.world, point.x, point.y);
  if (!tile || !isWalkableTile(tile) || tile.occupiedByBuildingId) return -Infinity;
  const nearestExisting = nearestSettlementDistance(state, point);
  if (nearestExisting < MIN_SETTLEMENT_DISTANCE_TILES) return -Infinity;
  const distance = Math.hypot(point.x - origin.centerX, point.y - origin.centerY);
  if (distance > maxColonizationDistance(state)) return -Infinity;

  const fertility = nearbyAverage(state, point, 5, (candidate) => candidate.fertility);
  const walkable = nearbyCount(state, point, 6, (candidate) => isWalkableTile(candidate) && !candidate.occupiedByBuildingId);
  const buildableCore = nearbyCount(state, point, 4, (candidate) => isWalkableTile(candidate) && !candidate.occupiedByBuildingId && candidate.type !== "rock");
  const wood = nearbyCount(state, point, 7, (candidate) => candidate.type === "forest" && candidate.resourceAmount > 0);
  const stone = nearbyCount(state, point, 7, (candidate) => candidate.type === "rock" && candidate.resourceAmount > 0);
  const water = nearbyCount(state, point, 5, (candidate) => isWater(candidate.type));
  const mountains = nearbyCount(state, point, 4, (candidate) => candidate.type === "mountain");
  const rough = nearbyCount(state, point, 4, (candidate) => candidate.type === "rock" || candidate.type === "mountain");
  const burned = nearbyCount(state, point, 5, (candidate) => candidate.type === "burned");
  if (walkable < 80 || buildableCore < 34 || water > 46 || mountains > 3) return -Infinity;
  const coastBonus = civilization.traits.includes("seafaring") && water > 0 ? 12 : 0;
  const expansionBonus = civilization.traits.includes("expansionist") ? 10 : 0;
  const agriculturalBonus = civilization.traits.includes("agricultural") ? fertility * 16 : 0;
  const owner = state.territory.ownerByTile[point.y * state.world.width + point.x];
  const hostilePenalty = owner && owner !== civilization.id ? 24 : 0;

  return (
    fertility * 34 +
    Math.min(wood, 8) * 2.4 +
    Math.min(stone, 7) * 2.2 +
    Math.min(water, 4) * 2 +
    Math.min(buildableCore, 56) * 0.35 +
    coastBonus +
    expansionBonus +
    agriculturalBonus -
    mountains * 4 -
    rough * 1.2 -
    burned * 3 -
    distance * 0.34 -
    hostilePenalty
  );
}

function maybePlanColonization(state: GameState): void {
  let plannedThisTick = 0;
  for (const civilization of state.civilizations) {
    if (civilization.population < COLONIZATION.minCapitalPopulation) continue;
    const activeGroups = state.colonistGroups.filter(
      (group) => group.civilizationId === civilization.id && (group.state === "traveling" || group.state === "preparing")
    ).length;
    const maxActiveGroups = COLONIZATION.maxActiveGroupsPerCivilization + (state.world.width >= 192 ? 1 : 0);
    if (activeGroups >= maxActiveGroups) continue;
    const targetSettlementCount = targetSettlementCountFor(state, civilization);
    const settlements = state.settlements.filter((settlement) => settlement.civilizationId === civilization.id);
    const origin = chooseColonizationOrigin(state, civilization);
    if (!origin) continue;
    const pressure =
      civilization.population > civilization.settlementIds.length * 16 ||
      settlements.some((settlement) => settlement.population > 28 && settlement.housingCapacity < settlement.population + 5) ||
      settlements.some((settlement) => settlement.population > 24 && settlement.foodSecurity < 50) ||
      civilization.traits.includes("expansionist");
    if (!pressure || civilization.settlementIds.length >= targetSettlementCount) continue;
    const foodReserve = Math.max(18, civilization.population * 1.2);
    const woodReserve = 22;
    if (state.resources.food < COLONIZATION.baseFoodCost + foodReserve || state.resources.wood < COLONIZATION.baseWoodCost + woodReserve) continue;
    const site = findExpansionSite(state, civilization, origin);
    if (!site) continue;
    state.resources.food -= COLONIZATION.baseFoodCost;
    state.resources.wood -= COLONIZATION.baseWoodCost;
    state.colonistGroups.push({
      id: state.ids.next("colonists"),
      civilizationId: civilization.id,
      originSettlementId: origin.id,
      x: origin.centerX,
      y: origin.centerY,
      targetX: site.x,
      targetY: site.y,
      settlers: COLONIZATION.settlers,
      resources: { food: COLONIZATION.baseFoodCost, wood: COLONIZATION.baseWoodCost, stone: 0 },
      targetName: uniqueSettlementName(state),
      state: "traveling"
    });
    addHistoricalEvent(state, "colonization", `${civilization.name} stuurde kolonisten uit vanuit ${origin.name}.`, {
      civilizationId: civilization.id,
      settlementId: origin.id,
      x: origin.centerX,
      y: origin.centerY
    });
    plannedThisTick += 1;
    if (plannedThisTick >= 3) return;
  }
}

function updateColonistGroups(state: GameState, dt: number): void {
  const remaining: ColonistGroup[] = [];
  for (const group of state.colonistGroups) {
    if (group.state !== "traveling") {
      remaining.push(group);
      continue;
    }
    const dx = group.targetX - group.x;
    const dy = group.targetY - group.y;
    const distance = Math.hypot(dx, dy);
    const speed = 0.88;
    group.resources.food = Math.max(0, group.resources.food - dt * 0.025 * group.settlers);
    if (group.resources.food <= 0 && state.rng.chance(0.015 * dt)) {
      group.settlers = Math.max(1, group.settlers - 1);
    }
    if (distance <= speed * dt || distance < 0.2) {
      foundSettlement(state, group);
      continue;
    }
    group.x += (dx / distance) * speed * dt;
    group.y += (dy / distance) * speed * dt;
    remaining.push(group);
  }
  state.colonistGroups = remaining;
}

function foundSettlement(state: GameState, group: ColonistGroup): void {
  const civilization = state.civilizations.find((item) => item.id === group.civilizationId);
  const origin = state.settlements.find((settlement) => settlement.id === group.originSettlementId);
  if (!civilization || !origin) return;
  const x = Math.floor(group.targetX);
  const y = Math.floor(group.targetY);
  const settlementId = state.ids.next("settlement");
  const campfire = createBuildingAt(state, "campfire", x - 1, y - 1, true);
  const storage = createBuildingAt(state, "storage", x + 2, y - 1, true);
  campfire.civilizationId = civilization.id;
  campfire.settlementId = settlementId;
  storage.civilizationId = civilization.id;
  storage.settlementId = settlementId;

  const residentIds: string[] = [];
  for (let index = 0; index < group.settlers; index += 1) {
    const villagerIndex = state.villagers.length;
    const villager = createVillager(
      state.ids.next("villager"),
      villagerName(villagerIndex),
      x + 0.5 + (index % 2) * 0.6,
      y + 1.4 + Math.floor(index / 2) * 0.6,
      assignJobByIndex(villagerIndex),
      state.rng.int(18, 42)
    );
    villager.civilizationId = civilization.id;
    villager.settlementId = settlementId;
    state.villagers.push(villager);
    residentIds.push(villager.id);
  }

  const settlement: Settlement = {
    id: settlementId,
    civilizationId: civilization.id,
    name: group.targetName,
    centerX: x,
    centerY: y,
    foundedYear: worldYear(state),
    tier: "camp",
    population: group.settlers,
    abstractPopulation: 0,
    housingCapacity: 0,
    foodProduction: 0,
    woodProduction: 0,
    stoneProduction: 0,
    metalProduction: 0,
    scienceProduction: 0,
    wealthProduction: 0,
    happiness: 68,
    stability: 70,
    defense: 0,
    foodSecurity: 46,
    buildingIds: [campfire.id, storage.id],
    residentIds,
    connectedSettlementIds: [],
    localPriorities: ["housing", "food", "wood"],
    stockpile: { food: group.resources.food, wood: group.resources.wood, stone: 0, metal: 0, tools: 0, wealth: 0, research: 0 },
    nextProject: "meer woningen"
  };
  civilization.settlementIds = Array.from(new Set([...civilization.settlementIds, settlement.id]));
  state.settlements.push(settlement);
  connectSettlementsWithRoad(state, origin, settlement);
  forceTerritoryRefresh(state);
  addHistoricalEvent(state, "settlementFounded", `${civilization.name} stichtten ${settlement.name}.`, {
    civilizationId: civilization.id,
    settlementId: settlement.id,
    x: settlement.centerX,
    y: settlement.centerY
  });
}

function updateSettlementTiers(state: GameState): void {
  for (const settlement of state.settlements) {
    const nextTier = evaluateSettlementTier(state, settlement);
    if (tierRank(nextTier) <= tierRank(settlement.tier)) continue;
    settlement.tier = nextTier;
    const civilization = state.civilizations.find((item) => item.id === settlement.civilizationId);
    addHistoricalEvent(state, "settlementUpgraded", `${settlement.name} groeide uit tot ${SETTLEMENT_TIER_LABELS[nextTier]}.`, {
      civilizationId: civilization?.id,
      settlementId: settlement.id,
      x: settlement.centerX,
      y: settlement.centerY
    });
    forceTerritoryRefresh(state);
  }
}

export function evaluateSettlementTier(state: GameState, settlement: Settlement): SettlementTier {
  const completed = state.buildings.filter((building) => building.settlementId === settlement.id && building.status === "complete");
  const completedTypes = new Set(completed.map((building) => building.type));
  const isCapital = state.civilizations.some((civilization) => civilization.capitalSettlementId === settlement.id);
  for (const rule of SETTLEMENT_TIER_RULES) {
    if (rule.tier === "capital" && !isCapital) continue;
    if (settlement.population < rule.minPopulation) continue;
    if (completed.length < rule.minBuildings) continue;
    if (settlement.foodSecurity < rule.minFoodSecurity) continue;
    if (settlement.defense < rule.minDefense) continue;
    if (rule.requiresConnection && settlement.connectedSettlementIds.length < 1) continue;
    if (!rule.requiredBuildings.every((type) => completedTypes.has(type as never))) continue;
    return rule.tier;
  }
  return "camp";
}

function findExpansionSite(state: GameState, civilization: Civilization, origin: Settlement): Point | undefined {
  let best: Point | undefined;
  let bestScore = -Infinity;
  for (let attempt = 0; attempt < COLONIZATION.searchAttemptsPerOrigin; attempt += 1) {
    const angle = state.rng.float(0, Math.PI * 2);
    const radius = state.rng.float(COLONIZATION.minDistance, maxColonizationDistance(state));
    const point = {
      x: Math.floor(origin.centerX + Math.cos(angle) * radius),
      y: Math.floor(origin.centerY + Math.sin(angle) * radius)
    };
    const score = scoreExpansionLocation(state, civilization, origin, point) + state.rng.float(-3, 3);
    if (score > bestScore) {
      best = point;
      bestScore = score;
    }
  }
  return bestScore > COLONIZATION.siteScoreThreshold ? best : undefined;
}

function targetSettlementCountFor(state: GameState, civilization: Civilization): number {
  const sizeBonus = Math.floor(state.world.width / 128) * COLONIZATION.settlementsPer128Tiles;
  const traitBonus = civilization.traits.includes("expansionist") ? COLONIZATION.expansionistBonusSettlements : 0;
  return COLONIZATION.baseSettlementTarget + sizeBonus + traitBonus;
}

function chooseColonizationOrigin(state: GameState, civilization: Civilization): Settlement | undefined {
  return state.settlements
    .filter((settlement) => settlement.civilizationId === civilization.id)
    .filter((settlement) => settlement.population >= COLONIZATION.minCapitalPopulation)
    .sort((a, b) => colonizationOriginScore(b) - colonizationOriginScore(a))[0];
}

function colonizationOriginScore(settlement: Settlement): number {
  const housingPressure = Math.max(0, settlement.population + 5 - settlement.housingCapacity) * 1.4;
  const foodPressure = Math.max(0, 54 - settlement.foodSecurity) * 0.4;
  const maturity = tierRank(settlement.tier) * 8 + settlement.population * 0.25;
  const connectedPenalty = settlement.connectedSettlementIds.length * 2;
  return maturity + housingPressure + foodPressure - connectedPenalty;
}

function maxColonizationDistance(state: GameState): number {
  return Math.max(MIN_SETTLEMENT_DISTANCE_TILES + 12, Math.min(Math.max(COLONIZATION.maxDistance, state.world.width * 0.28), Math.floor(state.world.width * 0.42)));
}

export function connectSettlementsWithRoad(state: GameState, a: Settlement, b: Settlement): number {
  if (a.id === b.id || a.civilizationId !== b.civilizationId || a.connectedSettlementIds.includes(b.id) || b.connectedSettlementIds.includes(a.id)) return 0;
  const start = roadAnchorForSettlement(state, a);
  const end = roadAnchorForSettlement(state, b);
  if (!start || !end) return 0;
  const result = state.pathfinder.findPath(state.world, start, end, { maxNodes: ROAD_NETWORK.maxPathNodes });
  if (result.path.length === 0) return 0;
  const buildable = result.path.filter((point) => {
    const tile = getTile(state.world, point.x, point.y);
    return tile && !tile.occupiedByBuildingId && isWalkableTile(tile) && tile.type !== "road";
  });
  const woodCost = Math.ceil(buildable.length * ROAD_NETWORK.woodCostPerNewTile);
  if (woodCost > 0 && state.resources.wood < woodCost) return 0;
  state.resources.wood = Math.max(0, state.resources.wood - woodCost);

  let built = 0;
  for (const point of result.path) {
    const tile = getTile(state.world, point.x, point.y);
    if (!tile || tile.occupiedByBuildingId || !isWalkableTile(tile)) continue;
    if (tile.type === "grass" || tile.type === "sand" || tile.type === "forest" || tile.type === "farmland" || tile.type === "burned") {
      tile.type = "road";
      tile.resourceAmount = 0;
      built += 1;
    }
  }
  a.connectedSettlementIds = Array.from(new Set([...a.connectedSettlementIds, b.id]));
  b.connectedSettlementIds = Array.from(new Set([...b.connectedSettlementIds, a.id]));
  state.world.version += 1;
  state.pathfinder.clear();
  return built;
}

function roadAnchorForSettlement(state: GameState, settlement: Settlement): Point | undefined {
  for (let radius = 1; radius <= 5; radius += 1) {
    let best: Point | undefined;
    let bestScore = Infinity;
    for (let y = settlement.centerY - radius; y <= settlement.centerY + radius; y += 1) {
      for (let x = settlement.centerX - radius; x <= settlement.centerX + radius; x += 1) {
        const tile = getTile(state.world, x, y);
        if (!tile || tile.occupiedByBuildingId || !isWalkableTile(tile)) continue;
        const roadBias = tile.type === "road" ? -8 : 0;
        const score = Math.hypot(x - settlement.centerX, y - settlement.centerY) + roadBias;
        if (score < bestScore) {
          best = { x, y };
          bestScore = score;
        }
      }
    }
    if (best) return best;
  }
  return undefined;
}

function nearestConnectedSettlement(settlements: Settlement[], settlement: Settlement, capital: Settlement): Settlement | undefined {
  const connected = settlements.filter((candidate) => candidate.id !== settlement.id && (candidate.id === capital.id || candidate.connectedSettlementIds.length > 0));
  return (connected.length > 0 ? connected : settlements.filter((candidate) => candidate.id !== settlement.id)).sort(
    (a, b) =>
      Math.hypot(a.centerX - settlement.centerX, a.centerY - settlement.centerY) -
      Math.hypot(b.centerX - settlement.centerX, b.centerY - settlement.centerY)
  )[0];
}

function closestUnconnectedPair(settlements: Settlement[]): { a: Settlement; b: Settlement; distance: number } | undefined {
  let best: { a: Settlement; b: Settlement; distance: number } | undefined;
  for (let i = 0; i < settlements.length; i += 1) {
    for (let j = i + 1; j < settlements.length; j += 1) {
      const a = settlements[i];
      const b = settlements[j];
      if (a.connectedSettlementIds.includes(b.id) || b.connectedSettlementIds.includes(a.id)) continue;
      const d = Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
      if (!best || d < best.distance) best = { a, b, distance: d };
    }
  }
  return best;
}

export function maintainRoadNetworks(state: GameState): number {
  let linksBuilt = 0;
  for (const civilization of state.civilizations) {
    const settlements = state.settlements.filter((settlement) => settlement.civilizationId === civilization.id);
    if (settlements.length < 2) continue;
    const capital = settlements.find((settlement) => settlement.id === civilization.capitalSettlementId) ?? settlements[0];
    const disconnected = settlements
      .filter((settlement) => settlement.id !== capital.id)
      .filter((settlement) => !settlement.connectedSettlementIds.some((id) => settlements.some((other) => other.id === id)));
    for (const settlement of disconnected) {
      const target = nearestConnectedSettlement(settlements, settlement, capital);
      if (!target) continue;
      if (connectSettlementsWithRoad(state, settlement, target) > 0) linksBuilt += 1;
      if (linksBuilt >= ROAD_NETWORK.maxLinksPerStrategyTick) return linksBuilt;
    }

    const extraPair = closestUnconnectedPair(settlements);
    if (extraPair && extraPair.distance <= ROAD_NETWORK.maxExtraLinkDistance && connectSettlementsWithRoad(state, extraPair.a, extraPair.b) > 0) {
      linksBuilt += 1;
      if (linksBuilt >= ROAD_NETWORK.maxLinksPerStrategyTick) return linksBuilt;
    }
  }
  return linksBuilt;
}

function maybeCreateMigration(state: GameState): void {
  const troubled = state.settlements.find((settlement) => settlement.foodSecurity < 25 && settlement.population > 8);
  const destination = troubled
    ? state.settlements.find((settlement) => settlement.civilizationId === troubled.civilizationId && settlement.id !== troubled.id && settlement.foodSecurity > 60)
    : undefined;
  if (!troubled || !destination || state.migrationGroups.some((group) => group.fromSettlementId === troubled.id)) return;
  state.migrationGroups.push({
    id: state.ids.next("migration"),
    fromSettlementId: troubled.id,
    toSettlementId: destination.id,
    x: troubled.centerX,
    y: troubled.centerY,
    migrants: 2,
    reason: "voedseltekort"
  });
  troubled.abstractPopulation = Math.max(0, troubled.abstractPopulation - 2);
  addHistoricalEvent(state, "famine", `${troubled.name} stuurde migranten weg door voedseltekort.`, {
    civilizationId: troubled.civilizationId,
    settlementId: troubled.id,
    x: troubled.centerX,
    y: troubled.centerY
  });
}

function updateMigrationGroups(state: GameState, dt: number): void {
  state.migrationGroups = state.migrationGroups.filter((group) => {
    const destination = state.settlements.find((settlement) => settlement.id === group.toSettlementId);
    if (!destination) return false;
    const dx = destination.centerX - group.x;
    const dy = destination.centerY - group.y;
    const distance = Math.hypot(dx, dy);
    const speed = 0.95;
    if (distance <= speed * dt || distance < 0.2) {
      destination.abstractPopulation += group.migrants;
      addHistoricalEvent(state, "colonization", `${group.migrants} migranten bereikten ${destination.name}.`, {
        civilizationId: destination.civilizationId,
        settlementId: destination.id,
        x: destination.centerX,
        y: destination.centerY
      });
      return false;
    }
    group.x += (dx / distance) * speed * dt;
    group.y += (dy / distance) * speed * dt;
    return true;
  });
}

function nearestSettlementDistance(state: GameState, point: Point): number {
  return state.settlements.reduce((best, settlement) => Math.min(best, Math.hypot(point.x - settlement.centerX, point.y - settlement.centerY)), Infinity);
}

function nearbyCount(
  state: GameState,
  center: Point,
  radius: number,
  predicate: (tile: NonNullable<ReturnType<typeof getTile>>) => boolean
): number {
  let count = 0;
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const tile = getTile(state.world, x, y);
      if (tile && predicate(tile)) count += 1;
    }
  }
  return count;
}

function nearbyAverage(state: GameState, center: Point, radius: number, value: (tile: NonNullable<ReturnType<typeof getTile>>) => number): number {
  let sum = 0;
  let count = 0;
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const tile = getTile(state.world, x, y);
      if (!tile) continue;
      sum += value(tile);
      count += 1;
    }
  }
  return count > 0 ? clamp(sum / count, 0, 1) : 0;
}

function uniqueSettlementName(state: GameState): string {
  const base = `${state.rng.pick(SETTLEMENT_PREFIXES)}${state.rng.pick(SETTLEMENT_SUFFIXES)}`;
  const existing = new Set(state.settlements.map((settlement) => settlement.name));
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

function tierRank(tier: SettlementTier): number {
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
