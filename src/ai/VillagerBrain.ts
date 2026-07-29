import { preferredWork } from "./Jobs";
import { GameState } from "../app/GameState";
import { allMaterialsDelivered, buildingCenter, materialMissing, BUILDING_DEFINITIONS, Building } from "../entities/Building";
import { ResourceType } from "../entities/Resources";
import { say, setVillagerState } from "./VillagerStateMachine";
import { Villager } from "../entities/Villager";
import { Point, distance } from "../utils/MathUtils";
import { isWalkableTile } from "../world/Tile";
import { getTile } from "../world/World";
import { addEvent } from "../simulation/EventSystem";
import { addHistoricalEvent } from "../simulation/HistorySystem";
import { assignHomes, hasValidHome } from "../simulation/HousingSystem";
import { beginEmergencyAction, completeEmergencyAction } from "../simulation/EmergencyResponseSystem";

const RESOURCE_TYPES: ResourceType[] = ["wood", "food", "stone"];

export function updateVillager(villager: Villager, state: GameState, dt: number): void {
  villager.age += dt / 240;
  villager.hunger = Math.min(100, villager.hunger + dt * 0.18);
  villager.energy = Math.max(0, villager.energy - dt * (state.time.isNight ? 0.18 : 0.08));
  villager.happiness = clampStat(villager.happiness + (villager.hunger < 70 ? 0.012 : -0.035) * dt);
  villager.speechTimer = Math.max(0, villager.speechTimer - dt);
  if (villager.speechTimer <= 0) villager.speech = undefined;

  if (!villager.emergencyFire && isFireNearby(villager, state)) {
    fleeFire(villager, state);
  }

  if (villager.actionTimer > 0) {
    villager.actionTimer -= dt;
    if (villager.actionTimer <= 0) completeAction(villager, state);
    return;
  }

  if (villager.path.length > 0) {
    moveAlongPath(villager, state, dt);
    return;
  }

  decideNextAction(villager, state);
}

function completeAction(villager: Villager, state: GameState): void {
  if (completeEmergencyAction(villager, state)) return;

  if (villager.state === "gatherFood" && villager.targetTile) {
    const tile = getTile(state.world, villager.targetTile.x, villager.targetTile.y);
    if (tile && tile.resourceAmount > 0) {
      const amount = Math.min(4, tile.resourceAmount);
      tile.resourceAmount -= amount;
      villager.carrying = { type: "food", amount };
      villager.hunger = Math.max(0, villager.hunger - 22);
      say(villager, "+food");
      walkToStorage(villager, state, "deliverFood");
      return;
    }
  }

  if (villager.state === "chopTree" && villager.targetTile) {
    const tile = getTile(state.world, villager.targetTile.x, villager.targetTile.y);
    if (tile && tile.type === "forest") {
      const managed = nearbyForestry(state, villager, tile.x, tile.y);
      const amount = managed ? 10 : state.buildingEffects.woodBonus ? 7 : 5;
      tile.resourceAmount -= 1;
      if (tile.resourceAmount <= 0) {
        tile.type = managed ? "forest" : "grass";
        tile.resourceAmount = managed ? 0 : tile.resourceAmount;
        state.world.version += 1;
      }
      villager.carrying = { type: "wood", amount };
      say(villager, "+wood");
      walkToStorage(villager, state, "deliverWood");
      return;
    }
  }

  if (villager.state === "mineStone" && villager.targetTile) {
    const tile = getTile(state.world, villager.targetTile.x, villager.targetTile.y);
    if (tile && tile.type === "rock" && tile.resourceAmount > 0) {
      const amount = Math.min(state.buildingEffects.workshopBonus ? 5 : 4, tile.resourceAmount + 1);
      tile.resourceAmount -= 1;
      if (tile.resourceAmount <= 0) {
        tile.type = "grass";
        state.world.version += 1;
      }
      villager.carrying = { type: "stone", amount };
      say(villager, "+stone");
      walkToStorage(villager, state, "deliverStone");
      return;
    }
  }

  if (villager.state === "eat") {
    if (state.resources.food > 0) {
      state.resources.food -= 1;
      villager.hunger = Math.max(0, villager.hunger - 58);
      villager.happiness = clampStat(villager.happiness + 6);
      say(villager, "yum");
    }
    setVillagerState(villager, "idle");
    return;
  }

  if (villager.state === "build" && villager.targetBuildingId) {
    const building = state.buildings.find((item) => item.id === villager.targetBuildingId);
    if (building && allMaterialsDelivered(building)) {
      const work = state.buildingEffects.workshopBonus ? 13 : 9;
      building.status = "building";
      building.progress = Math.min(building.workRequired, building.progress + work);
      say(villager, "tap");
      if (building.progress >= building.workRequired) {
        completeBuilding(building, state, villager.name);
      }
    }
    setVillagerState(villager, "idle");
    return;
  }

  setVillagerState(villager, "idle");
}

function decideNextAction(villager: Villager, state: GameState): void {
  if (villager.health <= 0) return;
  if (villager.carrying) {
    const targetBuildSite = villager.targetBuildingId
      ? state.buildings.find((building) => building.id === villager.targetBuildingId && building.status !== "complete")
      : undefined;
    if (targetBuildSite && materialMissing(targetBuildSite, villager.carrying.type) > 0) {
      walkToBuilding(villager, state, targetBuildSite.id, "deliverMaterial");
    } else {
      walkToStorage(villager, state, deliveryStateFor(villager.carrying.type));
    }
    return;
  }

  if (villager.hunger > 76) {
    if (state.resources.food > 0) {
      walkToStorage(villager, state, "eat");
    } else {
      findFood(villager, state);
    }
    return;
  }

  if (villager.energy < 22 || (state.time.isNight && villager.energy < 62)) {
    goSleep(villager, state);
    return;
  }

  const buildSite = findUsefulBuildSite(state);
  if (buildSite) {
    const missingResource = missingStoredResourceForBuildSite(state, buildSite);
    if (missingResource) {
      gatherResource(villager, state, missingResource);
      return;
    }
  }

  if (buildSite && (villager.job === "builder" || state.rng.chance(0.62))) {
    if (!allMaterialsDelivered(buildSite)) {
      fetchMaterial(villager, state, buildSite);
    } else {
      walkToBuilding(villager, state, buildSite.id, "walkToBuildSite");
    }
    return;
  }

  const work = preferredWork(villager);
  if (state.buildingEffects.mineBonus && state.resources.stone < Math.max(10, state.villagers.length) && (work === "build" || state.rng.chance(0.35))) {
    findStone(villager, state);
    return;
  }
  if (state.resources.wood < 35 || work === "wood") {
    findTree(villager, state);
    return;
  }
  if (state.resources.food < state.villagers.length * 9 || work === "food") {
    findFood(villager, state);
    return;
  }

  if (state.rng.chance(0.1)) findFood(villager, state);
  else wander(villager, state);
}

function moveAlongPath(villager: Villager, state: GameState, dt: number): void {
  const next = villager.path[0];
  const dx = next.x + 0.5 - villager.x;
  const dy = next.y + 0.5 - villager.y;
  const length = Math.hypot(dx, dy);
  const currentTile = getTile(state.world, Math.floor(villager.x), Math.floor(villager.y));
  const roadBoost = currentTile?.type === "road" ? 1.4 : 1;
  const weatherFactor = state.weather.current === "rain" ? 0.88 : state.weather.current === "storm" ? 0.76 : 1;
  const step = villager.speed * roadBoost * weatherFactor * dt;

  if (length <= step || length < 0.02) {
    villager.x = next.x + 0.5;
    villager.y = next.y + 0.5;
    villager.path.shift();
    if (villager.path.length === 0) arrive(villager, state);
    return;
  }

  villager.x += (dx / length) * step;
  villager.y += (dy / length) * step;
}

function arrive(villager: Villager, state: GameState): void {
  switch (villager.state) {
    case "walkToFood":
      setVillagerState(villager, "gatherFood");
      villager.actionTimer = 2.2;
      break;
    case "walkToTree":
      setVillagerState(villager, "chopTree");
      villager.actionTimer = 2.2;
      break;
    case "walkToStone":
      setVillagerState(villager, "mineStone");
      villager.actionTimer = 2.4;
      break;
    case "deliverWood":
    case "deliverFood":
    case "deliverStone":
      if (villager.carrying) {
        state.resources[villager.carrying.type] += villager.carrying.amount;
        say(villager, "drop");
        villager.carrying = undefined;
      }
      setVillagerState(villager, "idle");
      break;
    case "deliverMaterial":
      deliverMaterial(villager, state);
      break;
    case "walkToBuildSite":
      setVillagerState(villager, "build");
      villager.actionTimer = 2;
      break;
    case "eat":
      villager.actionTimer = 0.8;
      break;
    case "sleep":
      villager.actionTimer = 5;
      villager.energy = Math.min(100, villager.energy + 34);
      villager.happiness = clampStat(villager.happiness + 1.5);
      break;
    case "walkToWater":
    case "walkToFire":
      if (beginEmergencyAction(villager)) break;
      setVillagerState(villager, "idle");
      break;
    default:
      setVillagerState(villager, "idle");
  }
}

function findFood(villager: Villager, state: GameState): void {
  setVillagerState(villager, "findFood");
  const tile = findNearestTile(state, villager, (candidate) =>
    (candidate.type === "grass" || candidate.type === "forest" || candidate.type === "farmland") && candidate.resourceAmount > 0
  );
  if (!tile) {
    wander(villager, state);
    return;
  }
  villager.targetTile = { x: tile.x, y: tile.y };
  setPath(villager, state, tile, "walkToFood");
}

function findTree(villager: Villager, state: GameState): void {
  setVillagerState(villager, "findTree");
  const forestry = nearestCompletedBuilding(state, villager, "forestry");
  const tile =
    forestry &&
    findNearestTile(
      state,
      buildingCenter(forestry),
      (candidate) => candidate.type === "forest" && candidate.resourceAmount > 0,
      18
    );
  const fallback = tile ?? findNearestTile(state, villager, (candidate) => candidate.type === "forest" && candidate.resourceAmount > 0);
  if (!fallback) {
    wander(villager, state);
    return;
  }
  villager.targetTile = { x: fallback.x, y: fallback.y };
  setPath(villager, state, fallback, "walkToTree");
}

function findStone(villager: Villager, state: GameState): void {
  setVillagerState(villager, "findStone");
  const tile = findNearestTile(
    state,
    villager,
    (candidate) => candidate.type === "rock" && candidate.resourceAmount > 0,
    Math.max(state.world.width, state.world.height)
  );
  if (!tile) {
    wander(villager, state);
    return;
  }
  villager.targetTile = { x: tile.x, y: tile.y };
  setPath(villager, state, tile, "walkToStone");
}

function walkToStorage(villager: Villager, state: GameState, nextState: "deliverWood" | "deliverFood" | "deliverStone" | "eat"): void {
  const storage = nearestCompletedBuilding(state, villager, "storage") ?? nearestCompletedBuilding(state, villager, "campfire");
  if (!storage) {
    setVillagerState(villager, "idle");
    return;
  }
  walkToBuilding(villager, state, storage.id, nextState);
}

function walkToBuilding(
  villager: Villager,
  state: GameState,
  buildingId: string,
  nextState: "deliverMaterial" | "walkToBuildSite" | "deliverWood" | "deliverFood" | "deliverStone" | "eat"
): void {
  const building = state.buildings.find((item) => item.id === buildingId);
  if (!building) return;
  const target = nearestWalkableAdjacent(state, building, villager);
  if (!target) {
    setVillagerState(villager, "idle");
    return;
  }
  villager.targetBuildingId = building.id;
  setPath(villager, state, target, nextState);
}

function fetchMaterial(villager: Villager, state: GameState, building: Building): void {
  for (const resource of RESOURCE_TYPES) {
    if (materialMissing(building, resource) > 0 && state.resources[resource] > 0) {
      const amount = Math.min(8, state.resources[resource], materialMissing(building, resource));
      state.resources[resource] -= amount;
      villager.carrying = { type: resource, amount };
      villager.targetBuildingId = building.id;
      walkToBuilding(villager, state, building.id, "deliverMaterial");
      return;
    }
  }
  setVillagerState(villager, "idle");
}

function gatherResource(villager: Villager, state: GameState, resource: ResourceType): void {
  if (resource === "wood") findTree(villager, state);
  else if (resource === "food") findFood(villager, state);
  else if (state.buildingEffects.mineBonus) findStone(villager, state);
  else if (state.resources.wood < 12) findTree(villager, state);
  else wander(villager, state);
}

function missingStoredResourceForBuildSite(state: GameState, building: Building): ResourceType | undefined {
  return RESOURCE_TYPES.find((resource) => materialMissing(building, resource) > 0 && state.resources[resource] <= 0);
}

function deliverMaterial(villager: Villager, state: GameState): void {
  const building = state.buildings.find((item) => item.id === villager.targetBuildingId);
  if (building && villager.carrying) {
    building.materialsDelivered[villager.carrying.type] += villager.carrying.amount;
    say(villager, "build");
    villager.carrying = undefined;
    if (allMaterialsDelivered(building)) {
      setVillagerState(villager, "walkToBuildSite");
      walkToBuilding(villager, state, building.id, "walkToBuildSite");
      return;
    }
  }
  setVillagerState(villager, "idle");
}

function goSleep(villager: Villager, state: GameState): void {
  if (!hasValidHome(state, villager)) assignHomes(state);
  const home = villager.homeId ? state.buildings.find((building) => building.id === villager.homeId && building.status === "complete") : undefined;
  if (!home) {
    villager.energy = Math.min(100, villager.energy + 4);
    villager.happiness = clampStat(villager.happiness - 1.8);
    if (villager.energy < 12) villager.health = Math.max(0, villager.health - 0.25);
    say(villager, "geen bed");
    setVillagerState(villager, "idle");
    return;
  }
  const restTile = nearestWalkableAdjacent(state, home, villager);
  if (!restTile) {
    setVillagerState(villager, "idle");
    return;
  }
  setPath(villager, state, restTile, "sleep");
}

function wander(villager: Villager, state: GameState): void {
  const center = state.world.spawn;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const target = {
      x: Math.floor(center.x + state.rng.float(-14, 15)),
      y: Math.floor(center.y + state.rng.float(-14, 15))
    };
    const tile = getTile(state.world, target.x, target.y);
    if (tile && isWalkableTile(tile)) {
      setPath(villager, state, target, "wander");
      return;
    }
  }
  setVillagerState(villager, "idle");
}

function fleeFire(villager: Villager, state: GameState): void {
  if (villager.state === "fleeFire" && villager.path.length > 0) return;
  const target = {
    x: Math.floor(villager.x + (villager.x - state.world.spawn.x > 0 ? 8 : -8)),
    y: Math.floor(villager.y + (villager.y - state.world.spawn.y > 0 ? 8 : -8))
  };
  const tile = findNearestWalkable(state, target);
  if (tile) {
    setPath(villager, state, tile, "fleeFire");
    say(villager, "!");
  }
}

function setPath(villager: Villager, state: GameState, target: Point, nextState: typeof villager.state): void {
  const result = state.pathfinder.findPath(state.world, villager, target);
  if (result.path.length <= 1) {
    if (Math.hypot(villager.x - (target.x + 0.5), villager.y - (target.y + 0.5)) < 1.2) {
      villager.x = target.x + 0.5;
      villager.y = target.y + 0.5;
      villager.path = [];
      villager.targetX = villager.x;
      villager.targetY = villager.y;
      setVillagerState(villager, nextState);
      arrive(villager, state);
      return;
    }
    setVillagerState(villager, "idle");
    return;
  }
  villager.path = result.path.slice(1);
  villager.targetX = target.x + 0.5;
  villager.targetY = target.y + 0.5;
  setVillagerState(villager, nextState);
}

function deliveryStateFor(resource: ResourceType): "deliverWood" | "deliverFood" | "deliverStone" {
  if (resource === "wood") return "deliverWood";
  if (resource === "food") return "deliverFood";
  return "deliverStone";
}

function findNearestTile(
  state: GameState,
  villager: Point,
  predicate: (tile: NonNullable<ReturnType<typeof getTile>>) => boolean,
  radius = 48
) {
  const startX = Math.floor(villager.x);
  const startY = Math.floor(villager.y);
  let best = undefined as NonNullable<ReturnType<typeof getTile>> | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let y = Math.max(0, startY - radius); y <= Math.min(state.world.height - 1, startY + radius); y += 1) {
    for (let x = Math.max(0, startX - radius); x <= Math.min(state.world.width - 1, startX + radius); x += 1) {
      const tile = getTile(state.world, x, y);
      if (!tile || !predicate(tile) || !isWalkableTile(tile)) continue;
      const distanceToTile = Math.abs(x - startX) + Math.abs(y - startY);
      if (distanceToTile < bestDistance) {
        best = tile;
        bestDistance = distanceToTile;
      }
    }
  }

  return best;
}

function findUsefulBuildSite(state: GameState): Building | undefined {
  return state.buildings.find(
    (building) =>
      building.status !== "complete" &&
      !state.fires.some(
        (fire) =>
          fire.x >= building.x - 3 &&
          fire.y >= building.y - 3 &&
          fire.x < building.x + building.width + 3 &&
          fire.y < building.y + building.height + 3
      )
  );
}

function nearestCompletedBuilding(state: GameState, point: Point, type: Building["type"]): Building | undefined {
  let best: Building | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const building of state.buildings) {
    if (building.type !== type || building.status !== "complete") continue;
    const d = distance(buildingCenter(building), point);
    if (d < bestDistance) {
      best = building;
      bestDistance = d;
    }
  }
  return best;
}

function nearestWalkableAdjacent(state: GameState, building: Building, point: Point): Point | undefined {
  const candidates: Point[] = [];
  for (let x = building.x - 1; x <= building.x + building.width; x += 1) {
    candidates.push({ x, y: building.y - 1 }, { x, y: building.y + building.height });
  }
  for (let y = building.y; y < building.y + building.height; y += 1) {
    candidates.push({ x: building.x - 1, y }, { x: building.x + building.width, y });
  }
  return candidates
    .filter((candidate) => {
      const tile = getTile(state.world, candidate.x, candidate.y);
      return tile && isWalkableTile(tile);
    })
    .sort((a, b) => distance(a, point) - distance(b, point))[0];
}

function findNearestWalkable(state: GameState, point: Point): Point | undefined {
  for (let radius = 0; radius < 12; radius += 1) {
    for (let y = point.y - radius; y <= point.y + radius; y += 1) {
      for (let x = point.x - radius; x <= point.x + radius; x += 1) {
        const tile = getTile(state.world, x, y);
        if (tile && isWalkableTile(tile)) return { x, y };
      }
    }
  }
  return undefined;
}

function completeBuilding(building: Building, state: GameState, builderName: string): void {
  const completedUpgrade = building.upgradeTargetLevel;
  building.status = "complete";
  building.progress = building.workRequired;
  if (completedUpgrade) {
    building.upgradeLevel = completedUpgrade;
    building.upgradeTargetLevel = undefined;
    building.visualEra = completedUpgrade >= 2 ? "stone" : "wood";
    building.maxHealth = Math.max(building.maxHealth, 100 + completedUpgrade * (building.type === "castle" ? 65 : 28));
    building.health = building.maxHealth;
    if (building.type === "castle") {
      const settlement = state.settlements.find((item) => item.id === building.settlementId);
      addHistoricalEvent(state, "castleUpgraded", `${settlement?.name ?? "De hoofdstad"} voltooide kasteelniveau ${completedUpgrade}.`, {
        civilizationId: building.civilizationId,
        settlementId: building.settlementId,
        x: building.x,
        y: building.y
      });
    }
  } else if (building.type === "castle") {
    addHistoricalEvent(state, "castleUpgraded", `${builderName} voltooide het eerste houten fort.`, {
      civilizationId: building.civilizationId,
      settlementId: building.settlementId,
      x: building.x,
      y: building.y
    });
  }
  if (building.type === "farm") {
    cultivateFarmPlots(state, building);
  }
  if (building.type === "mine") {
    openMineShaft(state, building);
  }
  if (building.type === "forestry") {
    establishManagedForest(state, building);
  }
  if (building.type !== "wall" && building.type !== "gate") createRoadToCenter(state, building);
  addEvent(state, `${builderName} voltooide ${buildingLabel(building.type)}.`);
}

function establishManagedForest(state: GameState, building: Building): void {
  let planted = 0;
  for (let radius = 2; radius <= 8 && planted < 28; radius += 1) {
    for (let y = building.y - radius; y < building.y + building.height + radius && planted < 28; y += 1) {
      for (let x = building.x - radius; x < building.x + building.width + radius && planted < 28; x += 1) {
        const onRing =
          x === building.x - radius ||
          x === building.x + building.width + radius - 1 ||
          y === building.y - radius ||
          y === building.y + building.height + radius - 1;
        if (!onRing || (x + y) % 2 !== 0) continue;
        const tile = getTile(state.world, x, y);
        if (!tile || tile.occupiedByBuildingId || tile.type !== "grass" || tile.fertility < 0.38) continue;
        tile.type = "forest";
        tile.resourceAmount = Math.max(1, tile.resourceAmount);
        planted += 1;
      }
    }
  }
  if (planted > 0) {
    state.world.version += 1;
    state.pathfinder.clear();
    addEvent(state, `${BUILDING_DEFINITIONS.forestry.label} plantte ${planted} nieuwe bospercelen.`);
  }
}

function nearbyForestry(state: GameState, villager: Villager, x: number, y: number): Building | undefined {
  return state.buildings.find(
    (building) =>
      building.type === "forestry" &&
      building.status === "complete" &&
      (!villager.settlementId || building.settlementId === villager.settlementId) &&
      Math.hypot(building.x + building.width / 2 - x, building.y + building.height / 2 - y) <= 18
  );
}

function cultivateFarmPlots(state: GameState, building: Building): void {
  for (let y = building.y - 2; y < building.y + building.height + 2; y += 1) {
    for (let x = building.x - 2; x < building.x + building.width + 2; x += 1) {
      const tile = getTile(state.world, x, y);
      if (!tile || tile.occupiedByBuildingId || tile.type === "water" || tile.type === "deepWater" || tile.type === "mountain" || tile.type === "rock") {
        continue;
      }
      if (tile.type === "grass" || tile.type === "sand" || tile.type === "burned" || tile.type === "farmland") {
        tile.type = "farmland";
        tile.resourceAmount = Math.max(3, tile.resourceAmount);
      }
    }
  }
  state.world.version += 1;
}

function openMineShaft(state: GameState, building: Building): void {
  let exposed = 0;
  for (let radius = 1; radius <= 5 && exposed < 5; radius += 1) {
    for (let y = building.y - radius; y < building.y + building.height + radius && exposed < 5; y += 1) {
      for (let x = building.x - radius; x < building.x + building.width + radius && exposed < 5; x += 1) {
        const onRing =
          x === building.x - radius ||
          x === building.x + building.width + radius - 1 ||
          y === building.y - radius ||
          y === building.y + building.height + radius - 1;
        if (!onRing) continue;
        const tile = getTile(state.world, x, y);
        if (!tile || tile.occupiedByBuildingId || tile.type === "water" || tile.type === "deepWater" || tile.type === "mountain" || tile.type === "road") {
          continue;
        }
        if (tile.type === "rock") {
          tile.resourceAmount = Math.max(tile.resourceAmount, 6);
        } else if (tile.type === "grass" || tile.type === "sand" || tile.type === "burned") {
          tile.type = "rock";
          tile.resourceAmount = 6;
        } else {
          continue;
        }
        exposed += 1;
      }
    }
  }
  if (exposed > 0) {
    state.world.version += 1;
    state.pathfinder.clear();
    addEvent(state, "De mijn legde een steenader bloot.");
  }
}

function createRoadToCenter(state: GameState, building: Building): void {
  const start = nearestWalkableAdjacent(state, building, buildingCenter(building));
  if (!start) return;
  const result = state.pathfinder.findPath(state.world, start, state.world.spawn, { maxNodes: 2200 });
  for (const point of result.path) {
    const tile = getTile(state.world, point.x, point.y);
    if (!tile || tile.occupiedByBuildingId || !isWalkableTile(tile)) continue;
    if (tile.type === "grass" || tile.type === "sand" || tile.type === "forest" || tile.type === "farmland" || tile.type === "burned") {
      tile.type = "road";
      tile.resourceAmount = 0;
    }
  }
  state.world.version += 1;
  state.pathfinder.clear();
}

function isFireNearby(villager: Villager, state: GameState): boolean {
  return state.fires.some((fire) => Math.hypot(fire.x + 0.5 - villager.x, fire.y + 0.5 - villager.y) < 3.2 && fire.intensity > 0.2);
}

function buildingLabel(type: Building["type"]): string {
  switch (type) {
    case "campfire":
      return "het kampvuur";
    case "storage":
      return "de opslag";
    case "house":
      return "een huis";
    case "woodcutter":
      return "de houthakkershut";
    case "forestry":
      return "het bosbouwbedrijf";
    case "mine":
      return "de mijn";
    case "farm":
      return "de boerderij";
    case "workshop":
      return "de werkplaats";
    case "watchtower":
      return "de uitkijktoren";
    case "well":
      return "de waterput";
    case "reservoir":
      return "het waterreservoir";
    case "firestation":
      return "de brandweerkazerne";
    case "harbor":
      return "de haven";
    case "market":
      return "de markt";
    case "school":
      return "de school";
    case "monument":
      return "het monument";
    case "barracks":
      return "de kazerne";
    case "castle":
      return "het centrale fort";
    case "wall":
      return "de stadsmuur";
    case "gate":
      return "de stadspoort";
  }
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}
