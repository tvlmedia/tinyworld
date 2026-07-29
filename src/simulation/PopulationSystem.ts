import { createVillager, villagerName } from "../entities/Villager";
import { assignJobByIndex } from "../ai/Jobs";
import { GameState } from "../app/GameState";
import { Building } from "../entities/Building";
import { getTile } from "../world/World";
import { isWalkableTile } from "../world/Tile";
import { addEvent } from "./EventSystem";
import { assignHomes, findHouseWithOpenBed, freeBedCount } from "./HousingSystem";

export function updatePopulation(state: GameState, dt: number): void {
  const populationLimit = state.world.width >= 512 ? 220 : state.world.width >= 256 ? 180 : 140;
  if (state.villagers.length >= populationLimit) return;
  state.populationTimer += dt;
  const growthInterval = Math.max(30, 68 - state.civilization.level * 6);
  if (state.populationTimer < growthInterval) return;
  state.populationTimer = 0;

  assignHomes(state);
  const averageHappiness =
    state.villagers.reduce((sum, villager) => sum + villager.happiness, 0) / Math.max(1, state.villagers.length);

  if (state.resources.food < state.villagers.length * 6 || freeBedCount(state) < 1 || averageHappiness < 52 || state.fires.length > 0) {
    return;
  }

  spawnVillager(state);
  if (state.villagers.length < populationLimit && state.civilization.level >= 2 && freeBedCount(state) >= 1 && state.resources.food > state.villagers.length * 8) {
    spawnVillager(state);
  }
  if (state.villagers.length < populationLimit && state.civilization.level >= 4 && freeBedCount(state) >= 1 && state.resources.food > state.villagers.length * 10) {
    spawnVillager(state);
  }
}

function spawnVillager(state: GameState): void {
  const home = findHouseWithOpenBed(state, state.world.spawn);
  if (!home) return;
  const position = findSpawnTile(state, home);
  if (!position) return;
  state.resources.food -= 8;
  const index = state.villagers.length;
  const name = villagerName(index);
  const villager = createVillager(state.ids.next("villager"), name, position.x + 0.5, position.y + 0.5, assignJobByIndex(index), 0);
  villager.homeId = home.id;
  villager.settlementId = home.settlementId;
  villager.civilizationId = home.civilizationId;
  state.villagers.push(villager);
  const settlement = state.settlements.find((item) => item.id === home.settlementId);
  addEvent(state, state.civilization.level >= 2 ? `${name} werd geboren in ${settlement?.name ?? state.world.name}.` : `${name} sloot zich aan bij het dorp.`);
}

function findSpawnTile(state: GameState, home: Building): { x: number; y: number } | undefined {
  const center = {
    x: Math.floor(home.x + home.width / 2),
    y: Math.floor(home.y + home.height / 2)
  };
  for (let radius = 2; radius < 9; radius += 1) {
    for (let y = center.y - radius; y <= center.y + radius; y += 1) {
      for (let x = center.x - radius; x <= center.x + radius; x += 1) {
        const tile = getTile(state.world, x, y);
        if (tile && isWalkableTile(tile)) return { x, y };
      }
    }
  }
  return undefined;
}
