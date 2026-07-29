import { GameState, Selection } from "../app/GameState";
import { buildingContains } from "../entities/Building";
import { distance } from "../utils/MathUtils";
import { getTile } from "../world/World";

export function selectAtWorldPosition(state: GameState, worldX: number, worldY: number): Selection {
  const tileX = Math.floor(worldX);
  const tileY = Math.floor(worldY);
  const villager = state.villagers
    .filter((candidate) => distance(candidate, { x: worldX, y: worldY }) < 0.65)
    .sort((a, b) => distance(a, { x: worldX, y: worldY }) - distance(b, { x: worldX, y: worldY }))[0];
  if (villager) return { kind: "villager", id: villager.id };

  const building = state.buildings.find((candidate) => buildingContains(candidate, tileX, tileY));
  if (building) return { kind: "building", id: building.id };

  const tile = getTile(state.world, tileX, tileY);
  if (tile) return { kind: "tile", x: tileX, y: tileY };

  return { kind: "none" };
}
