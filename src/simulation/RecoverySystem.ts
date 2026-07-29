import {
  GameState,
  createBuildingAt,
  occupyBuildingTiles,
  releaseBuildingTiles
} from "../app/GameState";
import { RECOVERY } from "../config/recoveryConfig";
import { BUILDING_DEFINITIONS, Building, BuildingType, materialMissing } from "../entities/Building";
import {
  RecoveryState,
  RecoveryTask,
  RecoveryTaskType,
  Settlement,
  createSettlementRecovery
} from "../entities/Civilization";
import { ResourceStore } from "../entities/Resources";
import { Villager, VillagerJob } from "../entities/Villager";
import { getTile } from "../world/World";
import { addEventDeduplicated } from "./EventSystem";
import { findBuildingSpot } from "./SettlementPlanner";
import { isBuildingUnlocked } from "./TechnologySystem";

const ESSENTIAL_TYPES: BuildingType[] = ["campfire", "farm", "storage", "house", "woodcutter"];
const LUXURY_TYPES: BuildingType[] = [
  "market",
  "school",
  "monument",
  "barracks",
  "castle",
  "wall",
  "gate",
  "watchtower",
  "harbor"
];

export function updateRecovery(state: GameState, dt: number): void {
  for (const settlement of state.settlements) {
    settlement.recovery ??= createSettlementRecovery();
    settlement.recovery.recentCrisisTimer = Math.max(0, settlement.recovery.recentCrisisTimer - dt);
  }
  state.civilizationTimers.recovery -= dt;
  if (state.civilizationTimers.recovery > 0) return;
  state.civilizationTimers.recovery = RECOVERY.evaluationInterval;

  for (const settlement of state.settlements) evaluateSettlementRecovery(state, settlement);
}

export function evaluateSettlementRecovery(state: GameState, settlement: Settlement): void {
  const recovery = settlement.recovery ?? (settlement.recovery = createSettlementRecovery());
  const previousPriorities = recovery.priorities;
  const buildings = state.buildings.filter((building) => building.settlementId === settlement.id);
  const operational = buildings.filter(isOperational);
  const residents = state.villagers.filter((villager) => villager.settlementId === settlement.id && villager.health > 0);
  const damaged = buildings.filter(
    (building) =>
      !building.ruined &&
      building.status === "complete" &&
      building.health > 0 &&
      building.health < building.maxHealth * RECOVERY.damagedHealthRatio
  );
  const ruins = buildings.filter((building) => building.ruined || building.damageState === "ruined");
  const fires = state.fires.filter(
    (fire) => Math.hypot(fire.x - settlement.centerX, fire.y - settlement.centerY) <= settlementRadius(buildings)
  );
  const foodBuildings = operational.filter((building) => building.type === "farm");
  const storageBuildings = operational.filter((building) => building.type === "storage" || building.type === "campfire");
  const woodBuildings = operational.filter(
    (building) => building.type === "woodcutter" || building.type === "forestry"
  );
  const foodCritical = state.resources.food < Math.max(4, settlement.population * RECOVERY.criticalFoodPerResident);
  const foodStressed = state.resources.food < Math.max(8, settlement.population * RECOVERY.stressedFoodPerResident);
  const noHousing = settlement.population > 0 && settlement.housingCapacity < settlement.population;
  const established = settlement.tier !== "camp" || state.time.day - settlement.foundedYear >= 2;
  const housingCrisis = established && noHousing;
  const missingFoodProduction = established && foodBuildings.length === 0;
  const missingStorage = established && settlement.population >= 6 && storageBuildings.length === 0;
  const missingWoodProduction = established && settlement.population >= 6 && woodBuildings.length === 0;
  const damagedShare = damaged.length / Math.max(1, buildings.length - ruins.length);
  const activeEssentialProject = buildings.some(
    (building) => ESSENTIAL_TYPES.includes(building.type) && building.status !== "complete" && !building.pausedForRecovery
  );
  const economyStopped =
    settlement.population > 0 &&
    residents.length > 0 &&
    !activeEssentialProject &&
    (missingFoodProduction || missingStorage || housingCrisis || missingWoodProduction);
  trackStalledProjects(state, settlement, buildings);

  recovery.damagedBuildings = damaged.length;
  recovery.ruinedBuildings = ruins.length;
  recovery.stuckResidents = residents.filter((villager) => villager.stuckElapsed > RECOVERY.stuckResidentTimeout / 2).length;
  recovery.priorities = recoveryPriorities({
    fires: fires.length,
    foodCritical,
    missingFoodProduction,
    missingStorage,
    noHousing: housingCrisis,
    missingWoodProduction,
    ruins: ruins.length,
    damaged: damaged.length
  });

  const previousState = recovery.state;
  const severe =
    fires.length > 0 ||
    foodCritical ||
    ruins.length > 0 ||
    damagedShare >= RECOVERY.damagedBuildingEmergencyShare ||
    economyStopped;
  const collapseRisk =
    settlement.population > 0 &&
    foodCritical &&
    residents.length === 0 &&
    !hasNearbyResource(state, settlement, "food");
  const unresolved =
    severe || foodStressed || housingCrisis || damaged.length > 0 || recovery.tasks.some(isOpenTask);
  if (unresolved) recovery.stableEvaluations = 0;
  else recovery.stableEvaluations += 1;
  recovery.state = nextRecoveryState(
    previousState,
    severe,
    collapseRisk,
    unresolved,
    recovery.stableEvaluations
  );

  if (severe || unresolved) {
    recovery.recentCrisisTimer = Math.max(recovery.recentCrisisTimer, RECOVERY.recentCrisisDuration);
  }

  if (previousState === "normal" && recovery.state !== "normal") {
    addEventDeduplicated(
      state,
      `${settlement.name} start een noodherstelprogramma.`,
      RECOVERY.eventCooldownMinutes
    );
  } else if (previousState !== "normal" && recovery.state === "normal") {
    addEventDeduplicated(state, `${settlement.name} verlaat de crisisstatus.`, RECOVERY.eventCooldownMinutes);
  }
  if (
    previousPriorities.includes("voedselproductie herstellen") &&
    !missingFoodProduction
  ) {
    addEventDeduplicated(
      state,
      `${settlement.name} heeft opnieuw voedselproductie.`,
      RECOVERY.eventCooldownMinutes
    );
  }
  if (previousPriorities.includes("actieve branden blussen") && fires.length === 0) {
    addEventDeduplicated(
      state,
      `${settlement.name} heeft alle actieve branden geblust.`,
      RECOVERY.eventCooldownMinutes
    );
  }

  pauseNonEssentialProjects(buildings, recovery.state !== "normal");
  refreshRecoveryTasks(state, settlement, {
    fires,
    damaged,
    ruins,
    missingFoodProduction,
    missingStorage,
    noHousing: housingCrisis,
    missingWoodProduction,
    foodCritical
  });
  processRecoveryTasks(state, settlement, residents);
  ensureRecoveryWorkforce(state, settlement, residents);
  recovery.tasks = recovery.tasks
    .filter((task) => task.status !== "cancelled" || state.time.day - task.createdDay < 2)
    .slice(-RECOVERY.taskHistoryLimit);
}

function refreshRecoveryTasks(
  state: GameState,
  settlement: Settlement,
  conditions: {
    fires: GameState["fires"];
    damaged: Building[];
    ruins: Building[];
    missingFoodProduction: boolean;
    missingStorage: boolean;
    noHousing: boolean;
    missingWoodProduction: boolean;
    foodCritical: boolean;
  }
): void {
  const recovery = settlement.recovery!;
  recovery.blockedReason = undefined;
  if (conditions.fires.length > 0) ensureTask(state, settlement, "extinguishFire", 100);
  completeTasks(recovery.tasks, "extinguishFire", conditions.fires.length === 0);
  if (conditions.foodCritical) ensureTask(state, settlement, "gatherFood", 95);
  completeTasks(recovery.tasks, "gatherFood", !conditions.foodCritical);

  for (const building of conditions.ruins) ensureTask(state, settlement, "clearRubble", 88, building);
  for (const building of conditions.damaged) ensureTask(state, settlement, "repairBuilding", repairPriority(building), building);

  if (conditions.missingFoodProduction) ensureMissingBuildingTask(state, settlement, "farm", 92);
  if (conditions.missingStorage) ensureMissingBuildingTask(state, settlement, "storage", 82);
  if (conditions.noHousing) ensureMissingBuildingTask(state, settlement, "house", 78);
  if (conditions.missingWoodProduction) ensureMissingBuildingTask(state, settlement, "woodcutter", 70);

  if (state.resources.wood < 8 && !hasOperationalBuilding(state, settlement, ["woodcutter", "forestry"])) {
    if (hasNearbyResource(state, settlement, "wood")) ensureTask(state, settlement, "gatherWood", 86);
    else {
      recovery.blockedReason = "geen bereikbare houtbron";
      addEventDeduplicated(
        state,
        `Herbouw in ${settlement.name} geblokkeerd: geen bereikbare houtbron.`,
        RECOVERY.eventCooldownMinutes
      );
    }
  } else {
    completeTasks(recovery.tasks, "gatherWood", true);
  }
  const needsStone = state.buildings.some(
    (building) =>
      building.settlementId === settlement.id &&
      building.status !== "complete" &&
      !building.ruined &&
      ESSENTIAL_TYPES.includes(building.type) &&
      materialMissing(building, "stone") > state.resources.stone
  );
  if (needsStone && !hasOperationalBuilding(state, settlement, ["mine"])) {
    if (hasNearbyResource(state, settlement, "stone")) ensureTask(state, settlement, "gatherStone", 62);
  } else {
    completeTasks(recovery.tasks, "gatherStone", true);
  }

  for (const task of recovery.tasks.filter(isOpenTask)) {
    if (!task.buildingId) continue;
    const building = state.buildings.find((item) => item.id === task.buildingId);
    if (!building) {
      task.status = "cancelled";
      task.blockedReason = "gebouw bestaat niet meer";
      continue;
    }
    const repairFinished =
      task.type === "repairBuilding" &&
      !building.repairing &&
      building.status === "complete" &&
      building.health >= building.maxHealth;
    const constructionFinished =
      (task.type === "rebuildBuilding" || task.type === "buildEmergency") && isOperational(building);
    if (repairFinished || constructionFinished) {
      task.status = "completed";
      building.recoveryTaskId = undefined;
    }
  }
}

function processRecoveryTasks(state: GameState, settlement: Settlement, residents: Villager[]): void {
  const recovery = settlement.recovery!;
  const availableWorkers = residents.filter((villager) => !villager.armyId && !villager.emergencyFire);
  const tasks = recovery.tasks.filter(isOpenTask).sort((a, b) => b.priority - a.priority || a.createdDay - b.createdDay);
  for (const task of tasks) {
    if (task.retryAfterDay && state.time.day < task.retryAfterDay) continue;
    if (task.type === "clearRubble") {
      const building = state.buildings.find((item) => item.id === task.buildingId);
      if (!building || !building.ruined) {
        task.status = "completed";
        continue;
      }
      if (hasFireNearBuilding(state, building)) {
        blockTask(state, task, "locatie brandt nog");
        continue;
      }
      if (availableWorkers.length === 0) {
        blockTask(state, task, "geen beschikbare werkers");
        continue;
      }
      task.status = "active";
      task.blockedReason = undefined;
      building.cleanupProgress = (building.cleanupProgress ?? 0) + Math.min(4, availableWorkers.length) * 3;
      if (building.cleanupProgress < RECOVERY.rubbleWorkRequired) continue;
      building.ruined = false;
      building.damageState = "damaged";
      building.cleanupProgress = RECOVERY.rubbleWorkRequired;
      building.status = "planned";
      building.health = building.maxHealth;
      task.status = "completed";
      const rebuild = ensureTask(state, settlement, "rebuildBuilding", 84, building);
      rebuild.status = "active";
      addEventDeduplicated(
        state,
        `${settlement.name} ruimde puin en herbouwt ${BUILDING_DEFINITIONS[building.type].label.toLowerCase()}.`,
        RECOVERY.eventCooldownMinutes
      );
      continue;
    }
    if (task.type === "repairBuilding") {
      startRepair(state, task);
      continue;
    }
    if (task.type === "buildEmergency") {
      if (!task.buildingId) planEmergencyBuilding(state, settlement, task);
      else task.status = "active";
    }
  }
}

function trackStalledProjects(state: GameState, settlement: Settlement, buildings: Building[]): void {
  for (const building of buildings) {
    if (
      building.status === "complete" ||
      building.ruined ||
      building.pausedForRecovery ||
      !ESSENTIAL_TYPES.includes(building.type)
    ) {
      building.stalledEvaluations = 0;
      building.lastRecoveryProgress = building.progress;
      continue;
    }
    if (building.progress > (building.lastRecoveryProgress ?? -1)) building.stalledEvaluations = 0;
    else building.stalledEvaluations = (building.stalledEvaluations ?? 0) + 1;
    building.lastRecoveryProgress = building.progress;
    if ((building.stalledEvaluations ?? 0) < 3) continue;
    const task = ensureTask(state, settlement, "rebuildBuilding", 72, building);
    task.status = "assigned";
    if (hasWalkableAccess(state, building)) continue;
    const spot = findBuildingSpot(state, building.type, {
      x: settlement.centerX,
      y: settlement.centerY
    });
    building.recoveryAttempts = (building.recoveryAttempts ?? 0) + 1;
    if (!spot) {
      blockTask(state, task, "bouwplaats is onbereikbaar");
      continue;
    }
    releaseBuildingTiles(state.world, building);
    building.x = spot.x;
    building.y = spot.y;
    occupyBuildingTiles(state.world, building);
    building.stalledEvaluations = 0;
    task.status = "assigned";
    task.blockedReason = undefined;
    state.pathfinder.clear();
  }
}

function startRepair(state: GameState, task: RecoveryTask): void {
  const building = state.buildings.find((item) => item.id === task.buildingId);
  if (!building || building.ruined) {
    task.status = building ? "cancelled" : "blocked";
    return;
  }
  if (building.repairing || building.status !== "complete") {
    task.status = "active";
    return;
  }
  if (hasFireNearBuilding(state, building)) {
    blockTask(state, task, "gebouw brandt nog");
    return;
  }
  building.repairing = true;
  building.damageState = "damaged";
  building.originalWorkRequired = building.workRequired;
  building.workRequired = RECOVERY.repairWorkRequired;
  building.progress = 0;
  building.status = "building";
  building.requiredMaterials = scaledCosts(building.type, RECOVERY.repairMaterialShare);
  building.materialsDelivered = { food: 0, wood: 0, stone: 0 };
  building.recoveryTaskId = task.id;
  task.status = "active";
  task.blockedReason = undefined;
}

function ensureMissingBuildingTask(
  state: GameState,
  settlement: Settlement,
  type: BuildingType,
  priority: number
): void {
  if (!isBuildingUnlocked(state, settlement.civilizationId, type)) return;
  const existing = state.buildings.some(
    (building) =>
      building.settlementId === settlement.id &&
      building.type === type &&
      !building.ruined &&
      (type !== "house" || building.status !== "complete")
  );
  if (existing) return;
  const task = ensureTask(state, settlement, "buildEmergency", priority, undefined, type);
  if (!task.buildingId) task.status = "queued";
}

function planEmergencyBuilding(state: GameState, settlement: Settlement, task: RecoveryTask): void {
  const type = task.buildingType as BuildingType | undefined;
  if (!type) {
    task.status = "cancelled";
    return;
  }
  const spot = findBuildingSpot(state, type, { x: settlement.centerX, y: settlement.centerY });
  task.attempts += 1;
  if (!spot) {
    blockTask(state, task, `geen geldige locatie voor ${BUILDING_DEFINITIONS[type].label.toLowerCase()}`);
    return;
  }
  const building = createBuildingAt(state, type, spot.x, spot.y);
  building.civilizationId = settlement.civilizationId;
  building.settlementId = settlement.id;
  building.emergencyBuilt = true;
  building.requiredMaterials = scaledCosts(type, RECOVERY.emergencyMaterialShare);
  building.workRequired = Math.max(4, Math.ceil(building.workRequired * RECOVERY.emergencyWorkShare));
  building.recoveryTaskId = task.id;
  if (type === "house") building.capacity = Math.min(2, BUILDING_DEFINITIONS.house.capacity ?? 2);
  if (type === "storage") building.storageCapacity = Math.min(60, BUILDING_DEFINITIONS.storage.storageCapacity ?? 60);
  settlement.buildingIds.push(building.id);
  task.buildingId = building.id;
  task.status = "active";
  task.blockedReason = undefined;
  addEventDeduplicated(
    state,
    `${settlement.name} bouwt een tijdelijke ${BUILDING_DEFINITIONS[type].label.toLowerCase()} voor het herstel.`,
    RECOVERY.eventCooldownMinutes
  );
}

function ensureRecoveryWorkforce(state: GameState, settlement: Settlement, residents: Villager[]): void {
  if (settlement.recovery?.state === "normal" || residents.length === 0) return;
  const available = residents
    .filter((villager) => !villager.armyId && !villager.emergencyFire)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (available.length === 0) return;
  const openTasks = settlement.recovery!.tasks.filter(isOpenTask);
  const foodCrisis = openTasks.some((task) => task.type === "gatherFood" || task.buildingType === "farm");
  const buildCrisis = openTasks.some((task) =>
    ["repairBuilding", "clearRubble", "rebuildBuilding", "buildEmergency"].includes(task.type)
  );
  const woodCrisis = openTasks.some((task) => task.type === "gatherWood");
  let cursor = 0;
  if (foodCrisis) assignRecoveryJob(available[cursor++], "gatherer");
  if (buildCrisis && cursor < available.length) assignRecoveryJob(available[cursor++], "builder");
  if (woodCrisis && cursor < available.length) assignRecoveryJob(available[cursor], "woodcutter");
}

function assignRecoveryJob(villager: Villager | undefined, job: VillagerJob): void {
  if (!villager || villager.job === job) return;
  villager.job = job;
  villager.workplaceId = undefined;
}

function ensureTask(
  state: GameState,
  settlement: Settlement,
  type: RecoveryTaskType,
  priority: number,
  building?: Building,
  buildingType?: BuildingType
): RecoveryTask {
  const recovery = settlement.recovery!;
  const existing = recovery.tasks.find(
    (task) =>
      isOpenTask(task) &&
      task.type === type &&
      task.buildingId === building?.id &&
      task.buildingType === (buildingType ?? building?.type)
  );
  if (existing) {
    existing.priority = Math.max(existing.priority, priority);
    return existing;
  }
  const task: RecoveryTask = {
    id: state.ids.next("recovery"),
    type,
    status: "queued",
    priority,
    createdDay: state.time.day,
    buildingId: building?.id,
    buildingType: buildingType ?? building?.type,
    attempts: 0
  };
  recovery.tasks.push(task);
  if (building) building.recoveryTaskId = task.id;
  return task;
}

function blockTask(state: GameState, task: RecoveryTask, reason: string): void {
  task.status = "blocked";
  task.blockedReason = reason;
  task.attempts += 1;
  task.retryAfterDay = state.time.day + RECOVERY.taskRetryDays;
}

function completeTasks(tasks: RecoveryTask[], type: RecoveryTaskType, condition: boolean): void {
  if (!condition) return;
  for (const task of tasks) {
    if (task.type === type && isOpenTask(task)) task.status = "completed";
  }
}

function nextRecoveryState(
  previous: RecoveryState,
  severe: boolean,
  collapseRisk: boolean,
  unresolved: boolean,
  stableEvaluations: number
): RecoveryState {
  if (collapseRisk) return "collapseRisk";
  if (severe) return "emergency";
  if (unresolved) return previous === "normal" ? "stressed" : "recovering";
  if (previous !== "normal" && stableEvaluations < RECOVERY.stableEvaluationsToExit) return "recovering";
  return "normal";
}

function recoveryPriorities(input: {
  fires: number;
  foodCritical: boolean;
  missingFoodProduction: boolean;
  missingStorage: boolean;
  noHousing: boolean;
  missingWoodProduction: boolean;
  ruins: number;
  damaged: number;
}): string[] {
  const priorities: string[] = [];
  if (input.fires > 0) priorities.push("actieve branden blussen");
  if (input.foodCritical) priorities.push("direct voedsel verzamelen");
  if (input.missingFoodProduction) priorities.push("voedselproductie herstellen");
  if (input.missingStorage) priorities.push("opslag herbouwen");
  if (input.noHousing) priorities.push("noodwoningen bouwen");
  if (input.missingWoodProduction) priorities.push("houtproductie herstellen");
  if (input.ruins > 0) priorities.push(`${input.ruins} puinlocaties opruimen`);
  if (input.damaged > 0) priorities.push(`${input.damaged} gebouwen repareren`);
  return priorities.slice(0, 4);
}

function pauseNonEssentialProjects(buildings: Building[], paused: boolean): void {
  for (const building of buildings) {
    if (building.status === "complete" || building.ruined || !LUXURY_TYPES.includes(building.type)) continue;
    building.pausedForRecovery = paused;
  }
}

function hasOperationalBuilding(state: GameState, settlement: Settlement, types: BuildingType[]): boolean {
  return state.buildings.some(
    (building) => building.settlementId === settlement.id && types.includes(building.type) && isOperational(building)
  );
}

function hasNearbyResource(
  state: GameState,
  settlement: Settlement,
  resource: "food" | "wood" | "stone"
): boolean {
  const radius = 48;
  for (let y = Math.max(0, settlement.centerY - radius); y <= Math.min(state.world.height - 1, settlement.centerY + radius); y += 1) {
    for (let x = Math.max(0, settlement.centerX - radius); x <= Math.min(state.world.width - 1, settlement.centerX + radius); x += 1) {
      const tile = getTile(state.world, x, y);
      if (!tile || tile.resourceAmount <= 0) continue;
      if (resource === "wood" && tile.type === "forest") return true;
      if (resource === "stone" && tile.type === "rock") return true;
      if (resource === "food" && (tile.type === "grass" || tile.type === "farmland") && tile.fertility > 0.35) return true;
    }
  }
  return false;
}

function hasFireNearBuilding(state: GameState, building: Building): boolean {
  return state.fires.some(
    (fire) =>
      fire.x >= building.x - 2 &&
      fire.y >= building.y - 2 &&
      fire.x < building.x + building.width + 2 &&
      fire.y < building.y + building.height + 2
  );
}

function hasWalkableAccess(state: GameState, building: Building): boolean {
  for (let x = building.x - 1; x <= building.x + building.width; x += 1) {
    const north = getTile(state.world, x, building.y - 1);
    const south = getTile(state.world, x, building.y + building.height);
    if ((north && !north.occupiedByBuildingId && north.type !== "water" && north.type !== "deepWater" && north.type !== "mountain") ||
        (south && !south.occupiedByBuildingId && south.type !== "water" && south.type !== "deepWater" && south.type !== "mountain")) {
      return true;
    }
  }
  for (let y = building.y; y < building.y + building.height; y += 1) {
    const west = getTile(state.world, building.x - 1, y);
    const east = getTile(state.world, building.x + building.width, y);
    if ((west && !west.occupiedByBuildingId && west.type !== "water" && west.type !== "deepWater" && west.type !== "mountain") ||
        (east && !east.occupiedByBuildingId && east.type !== "water" && east.type !== "deepWater" && east.type !== "mountain")) {
      return true;
    }
  }
  return false;
}

function settlementRadius(buildings: Building[]): number {
  if (buildings.length === 0) return 18;
  const minX = Math.min(...buildings.map((building) => building.x));
  const maxX = Math.max(...buildings.map((building) => building.x + building.width));
  const minY = Math.min(...buildings.map((building) => building.y));
  const maxY = Math.max(...buildings.map((building) => building.y + building.height));
  return Math.max(18, Math.hypot(maxX - minX, maxY - minY) / 2 + 8);
}

function scaledCosts(type: BuildingType, share: number): ResourceStore {
  const costs = BUILDING_DEFINITIONS[type].costs;
  return {
    food: Math.ceil((costs.food ?? 0) * share),
    wood: Math.ceil((costs.wood ?? 0) * share),
    stone: Math.ceil((costs.stone ?? 0) * share)
  };
}

function repairPriority(building: Building): number {
  if (building.type === "farm") return 90;
  if (building.type === "storage") return 80;
  if (building.type === "house") return 76;
  if (building.type === "woodcutter" || building.type === "forestry") return 68;
  return 48;
}

function isOperational(building: Building): boolean {
  return building.status === "complete" && !building.ruined && building.health > 0;
}

function isOpenTask(task: RecoveryTask): boolean {
  return task.status !== "completed" && task.status !== "cancelled";
}
