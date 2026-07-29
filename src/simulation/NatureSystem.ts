import { GameState } from "../app/GameState";
import { getTile } from "../world/World";

const BURNED_RECOVERY_SWEEP_SECONDS = 72;
const BURNED_RECOVERY_REQUIRED = 4.5;

export function updateNature(state: GameState, dt: number): void {
  const batches = Math.max(64, Math.floor(160 * dt));
  for (let index = 0; index < batches; index += 1) {
    state.natureCursor = (state.natureCursor + 1) % state.world.tiles.length;
    const tile = state.world.tiles[state.natureCursor];
    const rainBoost = state.weather.current === "rain" || state.weather.current === "storm" ? 0.05 : 0;
    const droughtPenalty = state.weather.current === "drought" ? 0.05 : 0;
    tile.moisture = Math.max(0, Math.min(1, tile.moisture + rainBoost * dt - droughtPenalty * dt));

    if ((tile.type === "grass" || tile.type === "farmland") && tile.resourceAmount < 5) {
      const growChance = (tile.fertility * 0.018 + tile.moisture * 0.012 + rainBoost) * dt;
      if (state.rng.chance(growChance)) tile.resourceAmount += 1;
    }

    if (tile.type === "forest" && tile.resourceAmount < 7 && state.rng.chance((0.008 + tile.moisture * 0.01) * dt)) {
      tile.resourceAmount += 1;
    }

    if (tile.type === "grass" && tile.resourceAmount === 0 && tile.fertility > 0.58 && tile.moisture > 0.45) {
      if (hasNeighborForest(state, tile.x, tile.y) && state.rng.chance(0.0025 * dt)) {
        tile.type = "forest";
        tile.resourceAmount = 1;
        state.world.version += 1;
      }
    }
  }
  updateBurnedGroundRecovery(state, dt);
}

function hasNeighborForest(state: GameState, x: number, y: number): boolean {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const tile = getTile(state.world, x + dx, y + dy);
      if (tile?.type === "forest") return true;
    }
  }
  return false;
}

function updateBurnedGroundRecovery(state: GameState, dt: number): void {
  if (state.world.tiles.length === 0) return;
  const checks = Math.max(32, Math.floor((state.world.tiles.length * dt) / BURNED_RECOVERY_SWEEP_SECONDS));
  const recoveryDaysPerCheck = (BURNED_RECOVERY_SWEEP_SECONDS * 10 * state.settings.dayNightSpeed) / (24 * 60);
  let recovered = false;

  for (let index = 0; index < checks; index += 1) {
    state.burnedRecoveryCursor = (state.burnedRecoveryCursor + 1) % state.world.tiles.length;
    const tile = state.world.tiles[state.burnedRecoveryCursor];
    if (tile.type !== "burned" || tile.occupiedByBuildingId) continue;

    const rainBonus = state.weather.current === "rain" || state.weather.current === "storm" ? 0.45 : 0;
    const droughtPenalty = state.weather.current === "drought" ? 0.55 : 0;
    const recoveryRate = Math.max(0.18, 0.62 + tile.fertility * 0.5 + tile.moisture * 0.35 + rainBonus - droughtPenalty);
    tile.resourceAmount = Math.min(BURNED_RECOVERY_REQUIRED, tile.resourceAmount + recoveryRate * recoveryDaysPerCheck);
    if (tile.resourceAmount < BURNED_RECOVERY_REQUIRED) continue;

    const forestCandidate = tile.fertility > 0.56 && tile.moisture > 0.48 && hasNeighborForest(state, tile.x, tile.y);
    tile.type = forestCandidate ? "forest" : "grass";
    tile.resourceAmount = forestCandidate ? 1 : tile.fertility > 0.45 ? 1 : 0;
    recovered = true;
  }

  if (recovered) {
    state.world.version += 1;
    state.pathfinder.clear();
  }
}
