import { GameState } from "../app/GameState";
import { Building, buildingCenter } from "../entities/Building";
import { Villager } from "../entities/Villager";
import { Point, neighbors4 } from "../utils/MathUtils";
import { isWalkableTile, isWater } from "../world/Tile";
import { getTile } from "../world/World";
import { addEvent } from "./EventSystem";
import { economyMultiplier } from "./TechnologySystem";

export function updateEmergencyResponse(state: GameState, dt = 0): void {
  if (state.fires.length === 0) {
    if (state.villagers.some((villager) => villager.emergencyFire)) clearFinishedAssignments(state);
    return;
  }
  clearFinishedAssignments(state);
  const fireTargets = state.fires
    .map((fire) => ({ fire, building: responseBuildingFor(state, fire) }))
    .filter((target): target is { fire: (typeof state.fires)[number]; building: Building } => !!target.building && !!target.building.civilizationId)
    .sort((a, b) => {
      const aDirect = buildingAt(state, a.fire.x, a.fire.y) ? 1 : 0;
      const bDirect = buildingAt(state, b.fire.x, b.fire.y) ? 1 : 0;
      return bDirect - aDirect || b.fire.intensity - a.fire.intensity;
    });

  for (const civilization of state.civilizations) {
    const stations = completedBuildings(state, civilization.id, "firestation");
    const maxIncidents = Math.min(5, 1 + stations.length * 2);
    const incidents = fireTargets.filter((target) => target.building.civilizationId === civilization.id).slice(0, maxIncidents);
    for (const incident of incidents) {
      if (tooDangerous(state, civilization.id, incident.fire)) {
        withdrawResponders(state, incident.fire);
        continue;
      }
      const settlement = state.settlements.find((item) => item.id === incident.building.settlementId);
      const waterSources = waterAccessPoints(state, incident.fire, civilization.id);
      if (!settlement || waterSources.length === 0) continue;
      const assigned = respondersFor(state, incident.fire);
      const reservoirs = completedBuildings(state, civilization.id, "reservoir").length;
      const desired = Math.min(8, 3 + stations.length * 2 + Math.min(2, reservoirs));
      const candidates = state.villagers
        .filter(
          (villager) =>
            villager.civilizationId === civilization.id &&
            villager.settlementId === settlement.id &&
            !villager.armyId &&
            villager.health > 35 &&
            !villager.emergencyFire
        )
        .sort((a, b) => Math.hypot(a.x - incident.fire.x, a.y - incident.fire.y) - Math.hypot(b.x - incident.fire.x, b.y - incident.fire.y));
      for (const villager of candidates.slice(0, Math.max(0, desired - assigned.length))) {
        const water = nearestReachableAccess(state, villager, waterSources);
        if (water) assignResponder(state, villager, incident.fire, water);
      }
      const activeResponders = respondersFor(state, incident.fire);
      if (assigned.length === 0 && activeResponders.length > 0) {
        addEvent(state, `Brandalarm in ${settlement.name}! Bewoners vormen een blusploeg.`);
      }
      if (dt > 0 && activeResponders.length > 0) {
        const stationBoost = stations.length > 0 ? 1.35 : 1;
        const technology = economyMultiplier(civilization, "firefighting");
        const containment = activeResponders.length * 0.03 * stationBoost * technology * dt;
        incident.fire.intensity = Math.max(0, incident.fire.intensity - containment);
        incident.fire.fuel = Math.max(0, incident.fire.fuel - containment * 0.35);
      }
    }
  }
}

export function completeEmergencyAction(villager: Villager, state: GameState): boolean {
  if (villager.state === "collectWater" && villager.emergencyFire) {
    villager.carryingWater = 1;
    const access = fireAccessPoint(state, villager.emergencyFire, villager);
    if (!access) return clearEmergency(villager);
    if (!setEmergencyPath(state, villager, access, "walkToFire")) return clearEmergency(villager);
    return true;
  }
  if (villager.state === "extinguishFire" && villager.emergencyFire) {
    const fire = matchingFire(state, villager.emergencyFire);
    if (!fire) return clearEmergency(villager);
    const station = completedBuildings(state, villager.civilizationId, "firestation").length > 0 ? 1.35 : 1;
    const civilization = state.civilizations.find((item) => item.id === villager.civilizationId);
    const technology = economyMultiplier(civilization, "firefighting");
    const waterPower = 0.32 * station * technology;
    for (const nearbyFire of state.fires) {
      const distance = Math.hypot(nearbyFire.x - fire.x, nearbyFire.y - fire.y);
      if (distance > 1.5) continue;
      const splashPower = distance < 0.5 ? waterPower : waterPower * 0.45;
      nearbyFire.intensity = Math.max(0, nearbyFire.intensity - splashPower);
      nearbyFire.fuel = Math.max(0, nearbyFire.fuel - splashPower * 0.65);
    }
    villager.carryingWater = 0;
    villager.speech = "splash";
    villager.speechTimer = 1.2;
    if (fire.intensity <= 0.03) return clearEmergency(villager);
    const water = villager.emergencyWater;
    if (!water) return clearEmergency(villager);
    if (!setEmergencyPath(state, villager, water, "walkToWater")) return clearEmergency(villager);
    return true;
  }
  return false;
}

export function beginEmergencyAction(villager: Villager): boolean {
  if (villager.state === "walkToWater") {
    villager.state = "collectWater";
    villager.actionTimer = 1.25;
    return true;
  }
  if (villager.state === "walkToFire") {
    villager.state = "extinguishFire";
    villager.actionTimer = 1;
    return true;
  }
  return false;
}

function assignResponder(state: GameState, villager: Villager, fire: Point, water: Point): void {
  villager.emergencyFire = { x: fire.x, y: fire.y };
  villager.emergencyWater = water;
  villager.carrying = undefined;
  villager.carryingWater = 0;
  villager.speech = "Brand!";
  villager.speechTimer = 2;
  if (!setEmergencyPath(state, villager, water, "walkToWater")) clearEmergency(villager);
}

function setEmergencyPath(
  state: GameState,
  villager: Villager,
  target: Point,
  nextState: "walkToWater" | "walkToFire"
): boolean {
  const result = state.pathfinder.findPath(state.world, villager, target, { maxNodes: 2600 });
  const nearTarget = Math.hypot(villager.x - (target.x + 0.5), villager.y - (target.y + 0.5)) < 1.2;
  if (result.path.length <= 1 && !nearTarget) return false;
  villager.path = result.path.slice(1);
  villager.targetX = target.x + 0.5;
  villager.targetY = target.y + 0.5;
  villager.state = nextState;
  villager.actionTimer = 0;
  if (villager.path.length === 0) {
    villager.x = target.x + 0.5;
    villager.y = target.y + 0.5;
    beginEmergencyAction(villager);
  }
  return true;
}

function clearFinishedAssignments(state: GameState): void {
  for (const villager of state.villagers) {
    if (!villager.emergencyFire || matchingFire(state, villager.emergencyFire)) continue;
    clearEmergency(villager);
  }
}

function clearEmergency(villager: Villager): true {
  villager.emergencyFire = undefined;
  villager.emergencyWater = undefined;
  villager.carryingWater = 0;
  villager.path = [];
  villager.state = "idle";
  villager.actionTimer = 0;
  return true;
}

function withdrawResponders(state: GameState, fire: Point): void {
  for (const villager of respondersFor(state, fire)) {
    clearEmergency(villager);
    villager.speech = "te gevaarlijk";
    villager.speechTimer = 2;
  }
}

function respondersFor(state: GameState, fire: Point): Villager[] {
  return state.villagers.filter((villager) => villager.emergencyFire?.x === fire.x && villager.emergencyFire?.y === fire.y);
}

function matchingFire(state: GameState, point: Point) {
  return state.fires.find((fire) => fire.x === point.x && fire.y === point.y);
}

function buildingAt(state: GameState, x: number, y: number): Building | undefined {
  return state.buildings.find((building) => x >= building.x && y >= building.y && x < building.x + building.width && y < building.y + building.height);
}

function responseBuildingFor(state: GameState, fire: Point): Building | undefined {
  const direct = buildingAt(state, fire.x, fire.y);
  if (direct?.civilizationId) return direct;
  return state.buildings
    .filter((building) => !!building.civilizationId && building.status === "complete")
    .map((building) => ({ building, distance: distanceToBuilding(fire, building) }))
    .filter((candidate) => candidate.distance <= 8)
    .sort((a, b) => a.distance - b.distance)[0]?.building;
}

function distanceToBuilding(point: Point, building: Building): number {
  const nearestX = Math.max(building.x, Math.min(point.x, building.x + building.width - 1));
  const nearestY = Math.max(building.y, Math.min(point.y, building.y + building.height - 1));
  return Math.hypot(point.x - nearestX, point.y - nearestY);
}

function completedBuildings(state: GameState, civilizationId: string | undefined, type: Building["type"]): Building[] {
  if (!civilizationId) return [];
  return state.buildings.filter(
    (building) => building.civilizationId === civilizationId && building.type === type && building.status === "complete"
  );
}

function waterAccessPoints(state: GameState, fire: Point, civilizationId: string): Point[] {
  const buildingSources = state.buildings
    .filter(
      (building) =>
        building.civilizationId === civilizationId &&
        building.status === "complete" &&
        (building.type === "well" || building.type === "reservoir" || building.type === "firestation")
    )
    .flatMap((building) =>
      buildingPerimeter(building).filter((point) => {
        const tile = getTile(state.world, point.x, point.y);
        return tile && isWalkableTile(tile);
      })
    );
  const naturalSources: Point[] = [];
  for (let y = Math.max(0, fire.y - 24); y <= Math.min(state.world.height - 1, fire.y + 24); y += 1) {
    for (let x = Math.max(0, fire.x - 24); x <= Math.min(state.world.width - 1, fire.x + 24); x += 1) {
      const tile = getTile(state.world, x, y);
      if (!tile || !isWater(tile.type)) continue;
      for (const neighbor of neighbors4(tile)) {
        const access = getTile(state.world, neighbor.x, neighbor.y);
        if (access && isWalkableTile(access)) naturalSources.push(neighbor);
      }
    }
  }
  const sources = buildingSources.length > 0 ? buildingSources : naturalSources;
  return sources.sort(
    (a, b) => Math.hypot(a.x - fire.x, a.y - fire.y) - Math.hypot(b.x - fire.x, b.y - fire.y)
  );
}

function fireAccessPoint(state: GameState, fire: Point, villager: Villager): Point | undefined {
  const building = buildingAt(state, fire.x, fire.y);
  if (building) {
    return nearestReachableAccess(
      state,
      villager,
      buildingPerimeter(building).filter((point) => isSafeAccessPoint(state, point))
    );
  }

  for (let radius = 1; radius <= 5; radius += 1) {
    const candidates: Point[] = [];
    for (let y = fire.y - radius; y <= fire.y + radius; y += 1) {
      for (let x = fire.x - radius; x <= fire.x + radius; x += 1) {
        if (Math.max(Math.abs(x - fire.x), Math.abs(y - fire.y)) === radius) candidates.push({ x, y });
      }
    }
    const access = nearestReachableAccess(
      state,
      villager,
      candidates.filter((point) => isSafeAccessPoint(state, point))
    );
    if (access) return access;
  }
  return undefined;
}

function buildingPerimeter(building: Building): Point[] {
  const points: Point[] = [];
  for (let x = building.x - 1; x <= building.x + building.width; x += 1) {
    points.push({ x, y: building.y - 1 }, { x, y: building.y + building.height });
  }
  for (let y = building.y; y < building.y + building.height; y += 1) {
    points.push({ x: building.x - 1, y }, { x: building.x + building.width, y });
  }
  return points;
}

function isSafeAccessPoint(state: GameState, point: Point): boolean {
  const tile = getTile(state.world, point.x, point.y);
  return !!tile && isWalkableTile(tile) && !state.fires.some((fire) => fire.x === point.x && fire.y === point.y);
}

function nearestReachableAccess(state: GameState, villager: Villager, candidates: Point[]): Point | undefined {
  const ordered = candidates.sort(
    (a, b) => Math.hypot(a.x - villager.x, a.y - villager.y) - Math.hypot(b.x - villager.x, b.y - villager.y)
  );
  for (const candidate of ordered) {
    const nearTarget = Math.hypot(villager.x - (candidate.x + 0.5), villager.y - (candidate.y + 0.5)) < 1.2;
    const route = state.pathfinder.findPath(state.world, villager, candidate, { maxNodes: 2600 });
    if (nearTarget || route.path.length > 1) return candidate;
  }
  return undefined;
}

function tooDangerous(state: GameState, civilizationId: string, fire: Point): boolean {
  const hostile = state.armies.some(
    (army) => army.civilizationId !== civilizationId && Math.hypot(army.x - fire.x, army.y - fire.y) < 7 && army.strength > 8
  );
  if (!hostile) return false;
  return !state.armies.some(
    (army) => army.civilizationId === civilizationId && Math.hypot(army.x - fire.x, army.y - fire.y) < 9 && army.strength > 5
  );
}
