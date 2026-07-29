import { GameState } from "../app/GameState";
import { Building, buildingCenter } from "../entities/Building";
import { Villager } from "../entities/Villager";
import { Point, neighbors4 } from "../utils/MathUtils";
import { isWalkableTile, isWater } from "../world/Tile";
import { getTile } from "../world/World";
import { addEvent } from "./EventSystem";
import { economyMultiplier } from "./TechnologySystem";

export function updateEmergencyResponse(state: GameState): void {
  clearFinishedAssignments(state);
  const buildingFires = state.fires
    .map((fire) => ({ fire, building: buildingAt(state, fire.x, fire.y) }))
    .filter((target): target is { fire: (typeof state.fires)[number]; building: Building } => !!target.building && !!target.building.civilizationId)
    .sort((a, b) => b.fire.intensity - a.fire.intensity);

  for (const civilization of state.civilizations) {
    const stations = completedBuildings(state, civilization.id, "firestation");
    const maxIncidents = Math.min(4, 1 + stations.length);
    const incidents = buildingFires.filter((target) => target.building.civilizationId === civilization.id).slice(0, maxIncidents);
    for (const incident of incidents) {
      if (tooDangerous(state, civilization.id, incident.fire)) {
        withdrawResponders(state, incident.fire);
        continue;
      }
      const settlement = state.settlements.find((item) => item.id === incident.building.settlementId);
      const water = nearestWaterAccess(state, incident.fire, civilization.id);
      if (!settlement || !water) continue;
      const assigned = respondersFor(state, incident.fire);
      const reservoirs = completedBuildings(state, civilization.id, "reservoir").length;
      const desired = Math.min(8, 2 + stations.length * 2 + Math.min(2, reservoirs));
      if (assigned.length === 0) {
        addEvent(state, `Brandalarm in ${settlement.name}! Bewoners vormen een blusploeg.`);
      }
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
        assignResponder(state, villager, incident.fire, water);
      }
    }
  }
}

export function completeEmergencyAction(villager: Villager, state: GameState): boolean {
  if (villager.state === "collectWater" && villager.emergencyFire) {
    villager.carryingWater = 1;
    const access = fireAccessPoint(state, villager.emergencyFire, villager);
    if (!access) return clearEmergency(villager);
    setEmergencyPath(state, villager, access, "walkToFire");
    return true;
  }
  if (villager.state === "extinguishFire" && villager.emergencyFire) {
    const fire = matchingFire(state, villager.emergencyFire);
    if (!fire) return clearEmergency(villager);
    const station = completedBuildings(state, villager.civilizationId, "firestation").length > 0 ? 1.35 : 1;
    const civilization = state.civilizations.find((item) => item.id === villager.civilizationId);
    const technology = economyMultiplier(civilization, "firefighting");
    const waterPower = 0.18 * station * technology;
    fire.intensity = Math.max(0, fire.intensity - waterPower);
    fire.fuel = Math.max(0, fire.fuel - waterPower * 0.65);
    villager.carryingWater = 0;
    villager.speech = "splash";
    villager.speechTimer = 1.2;
    if (fire.intensity <= 0.03) return clearEmergency(villager);
    const water = villager.emergencyWater;
    if (!water) return clearEmergency(villager);
    setEmergencyPath(state, villager, water, "walkToWater");
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
  setEmergencyPath(state, villager, water, "walkToWater");
}

function setEmergencyPath(state: GameState, villager: Villager, target: Point, nextState: "walkToWater" | "walkToFire"): void {
  const result = state.pathfinder.findPath(state.world, villager, target, { maxNodes: 2600 });
  villager.path = result.path.slice(1);
  villager.targetX = target.x + 0.5;
  villager.targetY = target.y + 0.5;
  villager.state = nextState;
  villager.actionTimer = 0;
  if (villager.path.length === 0) beginEmergencyAction(villager);
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

function completedBuildings(state: GameState, civilizationId: string | undefined, type: Building["type"]): Building[] {
  if (!civilizationId) return [];
  return state.buildings.filter(
    (building) => building.civilizationId === civilizationId && building.type === type && building.status === "complete"
  );
}

function nearestWaterAccess(state: GameState, fire: Point, civilizationId: string): Point | undefined {
  const buildingSources = state.buildings
    .filter(
      (building) =>
        building.civilizationId === civilizationId &&
        building.status === "complete" &&
        (building.type === "well" || building.type === "reservoir" || building.type === "firestation")
    )
    .map((building) => nearestWalkableAroundBuilding(state, building, fire))
    .filter((point): point is Point => !!point);
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
  return [...buildingSources, ...naturalSources].sort(
    (a, b) => Math.hypot(a.x - fire.x, a.y - fire.y) - Math.hypot(b.x - fire.x, b.y - fire.y)
  )[0];
}

function nearestWalkableAroundBuilding(state: GameState, building: Building, target: Point): Point | undefined {
  const candidates: Point[] = [];
  for (let x = building.x - 1; x <= building.x + building.width; x += 1) {
    candidates.push({ x, y: building.y - 1 }, { x, y: building.y + building.height });
  }
  for (let y = building.y; y < building.y + building.height; y += 1) {
    candidates.push({ x: building.x - 1, y }, { x: building.x + building.width, y });
  }
  return candidates
    .filter((point) => {
      const tile = getTile(state.world, point.x, point.y);
      return tile && isWalkableTile(tile);
    })
    .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))[0];
}

function fireAccessPoint(state: GameState, fire: Point, villager: Villager): Point | undefined {
  return neighbors4(fire)
    .filter((point) => {
      const tile = getTile(state.world, point.x, point.y);
      return tile && isWalkableTile(tile) && !state.fires.some((item) => item.x === point.x && item.y === point.y);
    })
    .sort((a, b) => Math.hypot(a.x - villager.x, a.y - villager.y) - Math.hypot(b.x - villager.x, b.y - villager.y))[0];
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
