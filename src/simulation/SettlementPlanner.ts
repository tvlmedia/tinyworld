import { GameState, createBuildingAt } from "../app/GameState";
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

  const settlement = chooseSettlementForProject(state);
  if (!settlement && state.buildings.some((building) => building.status !== "complete")) return;
  const next = chooseNextBuilding(state, settlement);
  if (!next) return;
  const spot = findBuildingSpot(state, next, settlement ? { x: settlement.centerX, y: settlement.centerY } : undefined);
  if (!spot) return;
  const building = createBuildingAt(state, next, spot.x, spot.y);
  if (settlement) {
    building.settlementId = settlement.id;
    building.civilizationId = settlement.civilizationId;
    settlement.buildingIds.push(building.id);
  }
  addEvent(state, `Er is bij ${settlement?.name ?? state.world.name} een bouwplaats voor ${BUILDING_DEFINITIONS[next].label.toLowerCase()} gekozen.`);
  if (next === "farm") convertFootprintToFarmland(state, building.x, building.y, building.width, building.height);
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
  const desiredFarms = Math.min(8, Math.max(1, Math.ceil(population / 10)));
  const unlocked = (type: BuildingType) => isBuildingUnlocked(state, settlement?.civilizationId, type);

  if (completed("mine") < 1 && !planned("mine")) return "mine";
  if (population >= 10 && completed("market") >= 1 && unlocked("school") && completed("school") < 1 && !planned("school")) return "school";
  if (bedCapacity < population + 2 && !planned("house")) return "house";
  if ((completed("house") >= 1 || state.resources.food < 42) && completed("farm") < desiredFarms && !planned("farm")) return "farm";
  if (completed("woodcutter") < 1 && completed("house") >= 1 && !planned("woodcutter")) return "woodcutter";
  if (population >= 6 && completed("well") < 1 && !planned("well")) return "well";
  if (isStorageNearCapacity(state.resources, state.buildings) && completed("storage") < 3 && !planned("storage")) return "storage";
  if (population >= 7 && completed("workshop") < 1 && !planned("workshop")) return "workshop";
  if (
    population >= 18 &&
    completed("school") >= 1 &&
    isCoastal(state.world, { x: settlement?.centerX ?? state.world.spawn.x, y: settlement?.centerY ?? state.world.spawn.y }, 12)
  ) {
    if (unlocked("harbor") && completed("harbor") < 1 && !planned("harbor")) return "harbor";
  }
  if (population >= 8 && unlocked("market") && completed("market") < 1 && !planned("market")) return "market";
  if (population >= 24 && unlocked("reservoir") && completed("reservoir") < 1 && !planned("reservoir")) return "reservoir";
  if (population >= 35 && unlocked("firestation") && completed("firestation") < Math.max(1, Math.floor(population / 55)) && !planned("firestation")) {
    return "firestation";
  }
  const desiredForestry = population >= 42 ? 2 : 1;
  const needsScaledWood =
    population >= 20 &&
    completed("house") >= 3 &&
    completed("school") >= 1 &&
    (state.resources.wood < population * 5 || bedCapacity < population + 5);
  if (needsScaledWood && unlocked("forestry") && completed("forestry") < desiredForestry && !planned("forestry")) return "forestry";
  if (population >= 11 && unlocked("watchtower") && completed("watchtower") < 1 && !planned("watchtower")) return "watchtower";
  if (state.civilization.level >= 3 && unlocked("monument") && completed("monument") < 1 && !planned("monument")) return "monument";
  if (population >= 12 && completed("farm") < 5 && !planned("farm")) return "farm";
  if (population >= 14 && completed("storage") < 4 && !planned("storage")) return "storage";
  return undefined;
}

export function findBuildingSpot(state: GameState, type: BuildingType, center = state.world.spawn): Point | undefined {
  const definition = BUILDING_DEFINITIONS[type];
  const maxRadius = Math.min(30, Math.floor(state.world.width / 3));
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

function chooseSettlementForProject(state: GameState): Settlement | undefined {
  if (state.settlements.length === 0) return undefined;
  return state.settlements
    .filter((settlement) => !state.buildings.some((building) => building.settlementId === settlement.id && building.status !== "complete"))
    .filter((settlement) => chooseNextBuilding(state, settlement) !== undefined)
    .sort((a, b) => {
      const priorityDelta = projectWeight(state, b) - projectWeight(state, a);
      if (priorityDelta !== 0) return priorityDelta;
      return b.population - a.population;
    })[0];
}

function projectWeight(state: GameState, settlement: Settlement): number {
  const next = chooseNextBuilding(state, settlement);
  let weight = priorityWeight(settlement);
  if (state.civilizations.some((civilization) => civilization.capitalSettlementId === settlement.id)) weight += 1.5;
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
