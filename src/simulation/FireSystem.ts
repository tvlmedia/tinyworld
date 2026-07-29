import { GameState } from "../app/GameState";
import { FireState } from "../app/GameState";
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
  const fuel = tile.type === "forest" ? 5 : tile.type === "grass" || tile.type === "farmland" ? 2.6 : 1.5;
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
  const spreadChance = state.weather.current === "drought" ? 0.55 : state.weather.current === "rain" ? 0.06 : 0.25;
  for (const neighbor of neighbors4(fire)) {
    if (!state.rng.chance(spreadChance)) continue;
    const tile = getTile(state.world, neighbor.x, neighbor.y);
    if (!tile || tile.type === "water" || tile.type === "deepWater" || tile.type === "mountain") continue;
    if (state.fires.some((existing) => existing.x === neighbor.x && existing.y === neighbor.y)) continue;
    if (newFires.some((existing) => existing.x === neighbor.x && existing.y === neighbor.y)) continue;
    const fuel = tile.type === "forest" ? 5 : tile.type === "grass" || tile.type === "farmland" ? 2.4 : 1.2;
    newFires.push({ x: neighbor.x, y: neighbor.y, intensity: fire.intensity * 0.55, fuel, spreadTimer: 3 });
  }
}

function damageBuildingsAt(state: GameState, fire: FireState, dt: number): void {
  for (const building of state.buildings) {
    const inside = fire.x >= building.x && fire.y >= building.y && fire.x < building.x + building.width && fire.y < building.y + building.height;
    if (!inside) continue;
    building.health -= fire.intensity * dt * 2.2;
    if (building.health <= 0) {
      building.health = 0;
      addEvent(state, `${building.type} brandde af.`);
    }
  }
}
