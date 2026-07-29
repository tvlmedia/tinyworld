import { GameState, createBuildingAt } from "../app/GameState";
import { SETTLEMENT_GROWTH } from "../config/balanceConfig";
import { developmentStageFor, developmentStageRank } from "../config/developmentConfig";
import { BUILDING_DEFINITIONS, BuildingType } from "../entities/Building";
import { Settlement } from "../entities/Civilization";
import { Point, rectsOverlap } from "../utils/MathUtils";
import { isWalkableTile } from "../world/Tile";
import { getTile } from "../world/World";
import { isCoastal } from "../world/Maritime";
import { addEvent } from "./EventSystem";
import { isStorageNearCapacity } from "./ResourceSystem";
import { isBuildingUnlocked } from "./TechnologySystem";

export function updateSettlementPlanner(state: GameState, dt: number): void {
  state.plannerTimer -= dt;
  if (state.plannerTimer > 0) return;
  state.plannerTimer = 9;

  if (state.settlements.length === 0) {
    if (state.buildings.some((building) => building.status !== "complete")) return;
    planBuilding(state, undefined);
    return;
  }

  const projectBudget = Math.min(
    SETTLEMENT_GROWTH.maxPlannerProjectsPerCycle,
    Math.max(1, Math.ceil(state.settlements.length / SETTLEMENT_GROWTH.settlementsPerPlannerProject))
  );
  const considered = new Set<string>();
  for (let index = 0; index < projectBudget; index += 1) {
    const settlement = chooseSettlementForProject(state, considered);
    if (!settlement) break;
    considered.add(settlement.id);
    planBuilding(state, settlement);
  }
}

export function chooseNextBuilding(state: GameState, settlement = state.settlements[0]): BuildingType | undefined {
  const scopedBuildings = settlement
    ? state.buildings.filter((building) => building.settlementId === settlement.id)
    : state.buildings;
  const completed = (type: BuildingType) => scopedBuildings.filter((building) => building.type === type && building.status === "complete").length;
  const planned = (type: BuildingType) => scopedBuildings.some((building) => building.type === type && building.status !== "complete");
  const bedCapacity = state.buildings
    .filter((building) => building.status === "complete" && building.type === "house" && (!settlement || building.settlementId === settlement.id))
    .reduce((sum, building) => sum + building.capacity, 0);
  const population = settlement?.population ?? state.villagers.length;
  const temporaryHomes = scopedBuildings.filter(
    (building) => building.type === "house" && building.status === "complete" && building.emergencyBuilt
  ).length;
  const desiredFarms = Math.min(
    SETTLEMENT_GROWTH.maxFarmsPerSettlement,
    Math.max(1, Math.ceil(population / SETTLEMENT_GROWTH.populationPerFarm))
  );
  const desiredHousing = desiredHousingCapacity(population);
  const unlocked = (type: BuildingType) => isBuildingUnlocked(state, settlement?.civilizationId, type);
  const civilization = state.civilizations.find((item) => item.id === settlement?.civilizationId);
  const stage = civilization
    ? developmentStageFor(
        civilization,
        state.settlements.filter((item) => item.civilizationId === civilization.id)
      ).id
    : "camp";

  if (completed("mine") < 1 && !planned("mine")) return "mine";
  if (completed("house") < 1 && !planned("house")) return "house";
  if (completed("farm") < 1 && !planned("farm")) return "farm";
  if (completed("woodcutter") < 1 && !planned("woodcutter")) return "woodcutter";
  if (population >= 6 && completed("well") < 1 && !planned("well")) return "well";
  if (population >= 7 && completed("workshop") < 1 && !planned("workshop")) return "workshop";
  if (population >= 8 && unlocked("market") && completed("market") < 1 && !planned("market")) return "market";
  if (population >= 10 && completed("market") >= 1 && unlocked("school") && completed("school") < 1 && !planned("school")) return "school";
  if (
    (bedCapacity < desiredHousing || temporaryHomes > 0) &&
    !planned("house")
  ) {
    return "house";
  }
  if ((completed("house") >= 1 || state.resources.food < 42) && completed("farm") < desiredFarms && !planned("farm")) return "farm";
  const desiredWells = Math.min(4, Math.max(1, Math.ceil(population / 80)));
  if (population >= 6 && completed("well") < desiredWells && !planned("well")) return "well";
  const desiredStorage = Math.min(10, Math.max(3, Math.ceil(population / SETTLEMENT_GROWTH.populationPerStorage) + 1));
  if (isStorageNearCapacity(state.resources, state.buildings) && completed("storage") < desiredStorage && !planned("storage")) return "storage";
  const desiredWorkshops = Math.min(4, Math.max(1, Math.ceil(population / 100)));
  if (population >= 7 && completed("workshop") < desiredWorkshops && !planned("workshop")) return "workshop";
  if (
    population >= 18 &&
    completed("school") >= 1 &&
    isCoastal(state.world, { x: settlement?.centerX ?? state.world.spawn.x, y: settlement?.centerY ?? state.world.spawn.y }, 12)
  ) {
    if (unlocked("harbor") && completed("harbor") < 1 && !planned("harbor")) return "harbor";
  }
  if (population >= 24 && unlocked("reservoir") && completed("reservoir") < 1 && !planned("reservoir")) return "reservoir";
  if (population >= 35 && unlocked("firestation") && completed("firestation") < Math.max(1, Math.floor(population / 55)) && !planned("firestation")) {
    return "firestation";
  }
  if (
    population >= 42 &&
    developmentStageRank(stage) >= developmentStageRank("city") &&
    unlocked("barracks") &&
    completed("barracks") < Math.max(1, Math.floor(population / 90)) &&
    !planned("barracks")
  ) {
    return "barracks";
  }
  const desiredForestry = Math.min(
    SETTLEMENT_GROWTH.maxForestryPerSettlement,
    Math.max(1, Math.ceil(population / SETTLEMENT_GROWTH.populationPerForestry))
  );
  const needsScaledWood =
    population >= 20 &&
    completed("house") >= 3 &&
    (completed("school") >= 1 || developmentStageRank(stage) >= developmentStageRank("village")) &&
    (state.resources.wood < population * 5 || bedCapacity < desiredHousing);
  if (needsScaledWood && unlocked("forestry") && completed("forestry") < desiredForestry && !planned("forestry")) return "forestry";
  if (population >= 11 && unlocked("watchtower") && completed("watchtower") < 1 && !planned("watchtower")) return "watchtower";
  if (state.civilization.level >= 3 && unlocked("monument") && completed("monument") < 1 && !planned("monument")) return "monument";
  if (population >= 12 && completed("farm") < 5 && !planned("farm")) return "farm";
  if (population >= 14 && completed("storage") < desiredStorage && !planned("storage")) return "storage";
  return undefined;
}

export function findBuildingSpot(state: GameState, type: BuildingType, center = state.world.spawn): Point | undefined {
  const definition = BUILDING_DEFINITIONS[type];
  const nearbyBuildings = state.buildings.filter(
    (building) => Math.hypot(building.x - center.x, building.y - center.y) <= SETTLEMENT_GROWTH.maxBuildingRadius
  ).length;
  const expandingRadius = 30 + Math.floor(nearbyBuildings / 12) * 4;
  const maxRadius = Math.min(SETTLEMENT_GROWTH.maxBuildingRadius, expandingRadius, Math.floor(state.world.width / 3));
  for (let radius = 5; radius < maxRadius; radius += 2) {
    const candidates: Point[] = [];
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 10) {
      const wobble = state.rng.float(-1.8, 1.8);
      candidates.push({
        x: Math.floor(center.x + Math.cos(angle) * (radius + wobble) - definition.width / 2),
        y: Math.floor(center.y + Math.sin(angle) * (radius + wobble) - definition.height / 2)
      });
    }
    candidates.sort((a, b) => scoreSpot(state, a, type, center) - scoreSpot(state, b, type, center));
    for (const spot of candidates) {
      if (isValidBuildingSpot(state, spot.x, spot.y, type)) return spot;
    }
  }
  return undefined;
}

function chooseSettlementForProject(state: GameState, excluded = new Set<string>()): Settlement | undefined {
  if (state.settlements.length === 0) return undefined;
  return state.settlements
    .filter((settlement) => !excluded.has(settlement.id))
    .filter((settlement) => settlement.recovery?.state === undefined || settlement.recovery.state === "normal")
    .filter((settlement) => {
      const projects = state.buildings.filter(
        (building) => building.settlementId === settlement.id && building.status !== "complete"
      );
      const urgentHousing =
        settlement.housingCapacity < desiredHousingCapacity(settlement.population) &&
        !projects.some((building) => building.type === "house");
      return projects.length === 0 || urgentHousing;
    })
    .filter((settlement) => chooseNextBuilding(state, settlement) !== undefined)
    .sort((a, b) => {
      const priorityDelta = projectWeight(state, b) - projectWeight(state, a);
      if (priorityDelta !== 0) return priorityDelta;
      const populationDelta = a.population - b.population;
      if (populationDelta !== 0) return populationDelta;
      return a.id.localeCompare(b.id);
    })[0];
}

function projectWeight(state: GameState, settlement: Settlement): number {
  const next = chooseNextBuilding(state, settlement);
  let weight = priorityWeight(settlement);
  if (state.civilizations.some((civilization) => civilization.capitalSettlementId === settlement.id)) weight += 1.5;
  if (next === "house") {
    weight += Math.min(8, Math.max(0, desiredHousingCapacity(settlement.population) - settlement.housingCapacity) * 0.5);
  }
  if (next === "mine" || next === "workshop" || next === "forestry" || next === "market" || next === "school") weight += 3;
  if (next === "watchtower") weight += 2;
  if (settlement.tier === "camp" && (next === "house" || next === "farm")) weight += 1;
  return weight;
}

function priorityWeight(settlement: Settlement): number {
  const first = settlement.localPriorities[0];
  if (first === "housing" || first === "food") return 4;
  if (first === "wood" || first === "stone") return 3;
  if (first === "defense" || first === "science") return 2;
  return 1;
}

export function desiredHousingCapacity(population: number): number {
  return population + Math.max(
    SETTLEMENT_GROWTH.baseHousingReserve,
    Math.ceil(population * SETTLEMENT_GROWTH.housingReserveRatio)
  );
}

function planBuilding(state: GameState, settlement: Settlement | undefined): boolean {
  const next = chooseNextBuilding(state, settlement);
  if (!next) return false;
  const spot = findBuildingSpot(state, next, settlement ? { x: settlement.centerX, y: settlement.centerY } : undefined);
  if (!spot) return false;
  const building = createBuildingAt(state, next, spot.x, spot.y);
  if (settlement) {
    building.settlementId = settlement.id;
    building.civilizationId = settlement.civilizationId;
    settlement.buildingIds.push(building.id);
  }
  addEvent(state, `Er is bij ${settlement?.name ?? state.world.name} een bouwplaats voor ${BUILDING_DEFINITIONS[next].label.toLowerCase()} gekozen.`);
  if (next === "farm") convertFootprintToFarmland(state, building.x, building.y, building.width, building.height);
  return true;
}

export function isValidBuildingSpot(state: GameState, x: number, y: number, type: BuildingType): boolean {
  const definition = BUILDING_DEFINITIONS[type];
  if (x < 2 || y < 2 || x + definition.width >= state.world.width - 2 || y + definition.height >= state.world.height - 2) return false;
  const candidateRect = { x, y, width: definition.width, height: definition.height };
  for (const building of state.buildings) {
    const padded = { x: building.x - 1, y: building.y - 1, width: building.width + 2, height: building.height + 2 };
    if (rectsOverlap(candidateRect, padded)) return false;
  }
  for (let yy = y; yy < y + definition.height; yy += 1) {
    for (let xx = x; xx < x + definition.width; xx += 1) {
      const tile = getTile(state.world, xx, yy);
      if (!tile || !isWalkableTile(tile) || tile.type === "rock") return false;
    }
  }
  if (type === "harbor" && !isCoastal(state.world, { x: x + definition.width / 2, y: y + definition.height / 2 }, 5)) return false;
  return true;
}

function scoreSpot(state: GameState, spot: Point, type: BuildingType, center: Point): number {
  const centerDistance = Math.hypot(spot.x - center.x, spot.y - center.y);
  const roadBonus = nearbyRoadCount(state, spot) * -3;
  const farmFertility = type === "farm" ? -averageFertility(state, spot, BUILDING_DEFINITIONS[type].width, BUILDING_DEFINITIONS[type].height) * 16 : 0;
  const mineRocks = type === "mine" ? nearbyRockCount(state, spot) * -5 : 0;
  const forestryTrees = type === "forestry" ? nearbyForestCount(state, spot) * -1.4 : 0;
  const harborCoast = type === "harbor" ? nearbyWaterCount(state, spot) * -4 : 0;
  return centerDistance + roadBonus + farmFertility + mineRocks + forestryTrees + harborCoast;
}

function nearbyRoadCount(state: GameState, spot: Point): number {
  let count = 0;
  for (let y = spot.y - 4; y <= spot.y + 4; y += 1) {
    for (let x = spot.x - 4; x <= spot.x + 4; x += 1) {
      if (getTile(state.world, x, y)?.type === "road") count += 1;
    }
  }
  return count;
}

function averageFertility(state: GameState, spot: Point, width: number, height: number): number {
  let sum = 0;
  let count = 0;
  for (let y = spot.y; y < spot.y + height; y += 1) {
    for (let x = spot.x; x < spot.x + width; x += 1) {
      const tile = getTile(state.world, x, y);
      if (tile) {
        sum += tile.fertility;
        count += 1;
      }
    }
  }
  return count > 0 ? sum / count : 0;
}

function nearbyRockCount(state: GameState, spot: Point): number {
  let count = 0;
  for (let y = spot.y - 6; y <= spot.y + 6; y += 1) {
    for (let x = spot.x - 6; x <= spot.x + 6; x += 1) {
      const tile = getTile(state.world, x, y);
      if (tile?.type === "rock" && tile.resourceAmount > 0) count += 1;
    }
  }
  return count;
}

function nearbyForestCount(state: GameState, spot: Point): number {
  let count = 0;
  for (let y = spot.y - 8; y <= spot.y + 8; y += 1) {
    for (let x = spot.x - 8; x <= spot.x + 8; x += 1) {
      if (getTile(state.world, x, y)?.type === "forest") count += 1;
    }
  }
  return count;
}

function nearbyWaterCount(state: GameState, spot: Point): number {
  let count = 0;
  for (let y = spot.y - 5; y <= spot.y + 5; y += 1) {
    for (let x = spot.x - 5; x <= spot.x + 5; x += 1) {
      const type = getTile(state.world, x, y)?.type;
      if (type === "water" || type === "deepWater") count += 1;
    }
  }
  return count;
}

function convertFootprintToFarmland(state: GameState, x: number, y: number, width: number, height: number): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      const tile = getTile(state.world, xx, yy);
      if (tile) {
        tile.type = "farmland";
        tile.resourceAmount = Math.max(1, tile.resourceAmount);
      }
    }
  }
  state.world.version += 1;
}
