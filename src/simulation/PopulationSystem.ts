import { createVillager, villagerName } from "../entities/Villager";
import { assignJobByIndex } from "../ai/Jobs";
import { GameState } from "../app/GameState";
import { getTile } from "../world/World";
import { isWalkableTile } from "../world/Tile";
import { addEvent } from "./EventSystem";

export function updatePopulation(state: GameState, dt: number): void {
  if (state.villagers.length >= 100) return;
  state.populationTimer += dt;
  const growthInterval = Math.max(48, 82 - state.civilization.level * 8);
  if (state.populationTimer < growthInterval) return;
  state.populationTimer = 0;

  const capacity = state.buildings
    .filter((building) => building.status === "complete" && building.type === "house")
    .reduce((sum, building) => sum + building.capacity, 0);
  const averageHappiness =
    state.villagers.reduce((sum, villager) => sum + villager.happiness, 0) / Math.max(1, state.villagers.length);

  if (state.resources.food < state.villagers.length * 9 || capacity <= state.villagers.length || averageHappiness < 52 || state.fires.length > 0) {
    return;
  }

  spawnVillager(state);
  if (state.villagers.length < 100 && state.civilization.level >= 2 && capacity - state.villagers.length >= 2 && state.resources.food > state.villagers.length * 12) {
    spawnVillager(state);
  }
}

function spawnVillager(state: GameState): void {
  const position = findSpawnTile(state);
  if (!position) return;
  state.resources.food -= 10;
  const index = state.villagers.length;
  const name = villagerName(index);
  state.villagers.push(createVillager(state.ids.next("villager"), name, position.x + 0.5, position.y + 0.5, assignJobByIndex(index), 0));
  addEvent(state, state.civilization.level >= 2 ? `${name} werd geboren in ${state.world.name}.` : `${name} sloot zich aan bij het dorp.`);
}

function findSpawnTile(state: GameState): { x: number; y: number } | undefined {
  for (let radius = 2; radius < 9; radius += 1) {
    for (let y = state.world.spawn.y - radius; y <= state.world.spawn.y + radius; y += 1) {
      for (let x = state.world.spawn.x - radius; x <= state.world.spawn.x + radius; x += 1) {
        const tile = getTile(state.world, x, y);
        if (tile && isWalkableTile(tile)) return { x, y };
      }
    }
  }
  return undefined;
}
