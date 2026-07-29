import { GameState } from "../app/GameState";
import { getTile } from "../world/World";

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
