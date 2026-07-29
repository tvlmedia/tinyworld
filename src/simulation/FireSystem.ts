import { FireState, GameState, occupyBuildingTiles, releaseBuildingTiles } from "../app/GameState";
import { BUILDING_DEFINITIONS, Building } from "../entities/Building";
import { neighbors4 } from "../utils/MathUtils";
import { getTile } from "../world/World";
import { addEvent } from "./EventSystem";

export function updateFire(state: GameState, dt: number): void {
  const newFires: FireState[] = [];
  for (const fire of state.fires) {
    const tile = getTile(state.world, fire.x, fire.y);
    if (!tile) continue;
    const rain = state.weather.current === "rain" || state.weather.current === "storm";
    const drought = state.weather.current === "drought";
    fire.intensity += (drought ? 0.08 : 0.02) * dt;
    if (rain) fire.intensity -= 0.22 * dt;
    fire.fuel -= fire.intensity * dt * 0.16;
    fire.spreadTimer -= dt;

    if (fire.spreadTimer <= 0 && fire.intensity > 0.4) {
      fire.spreadTimer = drought ? 2.2 : 4.2;
      spreadFire(state, fire, newFires);
    }

    damageBuildingsAt(state, fire, dt);
    damageVillagersAt(state, fire, dt);

    if (fire.fuel <= 0 || fire.intensity <= 0.03) {
      if (tile.type === "forest" || tile.type === "grass" || tile.type === "farmland") {
        tile.type = "burned";
        tile.resourceAmount = 0;
        state.world.version += 1;
      }
      continue;
    }

    fire.intensity = Math.min(1.6, fire.intensity);
    newFires.push(fire);
  }

  state.fires = newFires;
}

export function igniteTile(state: GameState, x: number, y: number, intensity = 0.8): boolean {
  const tile = getTile(state.world, x, y);
  if (!tile || tile.type === "water" || tile.type === "deepWater" || tile.type === "mountain") return false;
  if (state.fires.some((fire) => fire.x === x && fire.y === y)) return false;
  const fuel = fireFuelForTile(state, x, y);
  state.fires.push({ x, y, intensity, fuel, spreadTimer: 2 });
  return true;
}

export function extinguishArea(state: GameState, x: number, y: number, radius = 4): void {
  state.fires = state.fires.filter((fire) => Math.hypot(fire.x - x, fire.y - y) > radius);
}

export function clearAllFires(state: GameState): void {
  state.fires = [];
}

function spreadFire(state: GameState, fire: FireState, newFires: FireState[]): void {
  const baseSpreadChance = state.weather.current === "drought" ? 0.55 : state.weather.current === "rain" ? 0.06 : 0.25;
  const spreadChance = baseSpreadChance * fireSpreadMultiplier(state, fire.x, fire.y);
  for (const neighbor of neighbors4(fire)) {
    if (!state.rng.chance(spreadChance)) continue;
    const tile = getTile(state.world, neighbor.x, neighbor.y);
    if (!tile || tile.type === "water" || tile.type === "deepWater" || tile.type === "mountain") continue;
    if (state.fires.some((existing) => existing.x === neighbor.x && existing.y === neighbor.y)) continue;
    if (newFires.some((existing) => existing.x === neighbor.x && existing.y === neighbor.y)) continue;
    const fuel = fireFuelForTile(state, neighbor.x, neighbor.y);
    newFires.push({ x: neighbor.x, y: neighbor.y, intensity: fire.intensity * 0.55, fuel, spreadTimer: 3 });
  }
}

function damageBuildingsAt(state: GameState, fire: FireState, dt: number): void {
  const destroyed: Building[] = [];
  for (const building of state.buildings) {
    if (building.status !== "complete") continue;
    const inside = fire.x >= building.x && fire.y >= building.y && fire.x < building.x + building.width && fire.y < building.y + building.height;
    if (!inside) continue;
    const resistance = building.visualEra === "stone" || building.visualEra === "industry" ? 0.58 : 1;
    building.health -= fire.intensity * dt * 3.4 * resistance;
    if (building.health <= 0) {
      building.health = 0;
      destroyed.push(building);
    }
  }
  for (const building of destroyed) destroyBuilding(state, building, fire);
}

function damageVillagersAt(state: GameState, fire: FireState, dt: number): void {
  const casualties = new Set<string>();
  for (const villager of state.villagers) {
    const d = Math.hypot(villager.x - (fire.x + 0.5), villager.y - (fire.y + 0.5));
    if (d > 1.05 + fire.intensity * 0.25) continue;
    villager.health -= fire.intensity * dt * 9;
    villager.happiness = Math.max(0, villager.happiness - fire.intensity * dt * 4);
    if (villager.health <= 0) casualties.add(villager.id);
  }
  removeCasualties(state, casualties, "kwam om in de brand.");
}

function destroyBuilding(state: GameState, building: Building, fire: FireState): void {
  if (!state.buildings.some((item) => item.id === building.id)) return;
  const casualties = new Set<string>();

  if (building.type === "house") {
    for (const villager of state.villagers) {
      if (villager.homeId === building.id) casualties.add(villager.id);
    }
  }

  for (const villager of state.villagers) {
    const inside =
      villager.x >= building.x &&
      villager.y >= building.y &&
      villager.x < building.x + building.width &&
      villager.y < building.y + building.height;
    const nearFlames = Math.hypot(villager.x - (fire.x + 0.5), villager.y - (fire.y + 0.5)) < 1.4;
    if (inside || nearFlames) casualties.add(villager.id);
  }

  const casualtyCount = removeCasualties(state, casualties, "kwam om toen een gebouw afbrandde.");
  releaseBuildingTiles(state.world, building);
  scorchFootprint(state, building);
  const costs = BUILDING_DEFINITIONS[building.type].costs;
  building.status = "planned";
  building.health = building.maxHealth;
  building.progress = 0;
  building.productionTimer = 0;
  building.materialsDelivered.wood = Math.floor((costs.wood ?? 0) * 0.3);
  building.materialsDelivered.food = Math.floor((costs.food ?? 0) * 0.3);
  building.materialsDelivered.stone = Math.floor((costs.stone ?? 0) * 0.45);
  occupyBuildingTiles(state.world, building);
  state.pathfinder.clear();

  const label = BUILDING_DEFINITIONS[building.type].label.toLowerCase();
  const victims = casualtyCount === 1 ? " 1 bewoner kwam om." : casualtyCount > 1 ? ` ${casualtyCount} bewoners kwamen om.` : "";
  addEvent(state, `De ${label} brandde af.${victims} Bewoners bergen materiaal en herbouwen zodra het veilig is.`);
}

function removeCasualties(state: GameState, casualties: Set<string>, fallbackText: string): number {
  if (casualties.size === 0) return 0;
  const names = state.villagers.filter((villager) => casualties.has(villager.id)).map((villager) => villager.name);
  state.villagers = state.villagers.filter((villager) => !casualties.has(villager.id));
  if (state.selected.kind === "villager" && casualties.has(state.selected.id)) state.selected = { kind: "none" };
  if (names.length === 1) addEvent(state, `${names[0]} ${fallbackText}`);
  return names.length;
}

function scorchFootprint(state: GameState, building: Building): void {
  for (let y = building.y; y < building.y + building.height; y += 1) {
    for (let x = building.x; x < building.x + building.width; x += 1) {
      const tile = getTile(state.world, x, y);
      if (!tile || tile.type === "water" || tile.type === "deepWater" || tile.type === "mountain") continue;
      tile.type = "burned";
      tile.resourceAmount = 0;
      tile.occupiedByBuildingId = undefined;
    }
  }
  state.world.version += 1;
}

function fireFuelForTile(state: GameState, x: number, y: number): number {
  const tile = getTile(state.world, x, y);
  if (!tile) return 0;
  if (tile.occupiedByBuildingId) return 8;
  if (tile.type === "forest") return 5;
  if (tile.type === "grass" || tile.type === "farmland") return 2.6;
  if (tile.type === "road" || tile.type === "burned") return 0.9;
  return 1.5;
}

function fireSpreadMultiplier(state: GameState, x: number, y: number): number {
  let multiplier = 1;
  const roadBreaks = neighbors4({ x, y }).filter((point) => getTile(state.world, point.x, point.y)?.type === "road").length;
  if (roadBreaks >= 2) multiplier *= 0.58;
  const protectedByWater = state.buildings.some(
    (building) =>
      building.status === "complete" &&
      !!building.civilizationId &&
      (building.type === "well" || building.type === "reservoir" || building.type === "firestation") &&
      Math.hypot(building.x + building.width / 2 - x, building.y + building.height / 2 - y) <
        (building.type === "firestation" ? 24 : building.type === "reservoir" ? 18 : 11)
  );
  if (protectedByWater) multiplier *= 0.68;
  return multiplier;
}
