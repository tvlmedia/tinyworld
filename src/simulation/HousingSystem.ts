import { GameState } from "../app/GameState";
import { Building } from "../entities/Building";
import { Villager } from "../entities/Villager";
import { distance } from "../utils/MathUtils";

export function updateHousing(state: GameState): void {
  assignHomes(state);
}

export function assignHomes(state: GameState): void {
  const houses = completedHouses(state);
  const validHomes = new Set(houses.map((house) => house.id));
  const occupancy = new Map<string, number>();
  for (const house of houses) occupancy.set(house.id, 0);

  for (const villager of state.villagers) {
    if (!villager.homeId || !validHomes.has(villager.homeId)) {
      villager.homeId = undefined;
      continue;
    }

    const house = houses.find((item) => item.id === villager.homeId);
    const used = house ? occupancy.get(house.id) ?? 0 : 0;
    if (!house || used >= house.capacity) {
      villager.homeId = undefined;
    } else {
      occupancy.set(house.id, used + 1);
    }
  }

  for (const villager of state.villagers) {
    if (villager.homeId) continue;
    const house = findHouseWithOpenBed(state, villager, occupancy);
    if (!house) continue;
    villager.homeId = house.id;
    occupancy.set(house.id, (occupancy.get(house.id) ?? 0) + 1);
  }
}

export function housingCapacity(state: GameState): number {
  return completedHouses(state).reduce((sum, house) => sum + house.capacity, 0);
}

export function usedBeds(state: GameState): number {
  const validHomes = new Set(completedHouses(state).map((house) => house.id));
  return state.villagers.filter((villager) => villager.homeId && validHomes.has(villager.homeId)).length;
}

export function freeBedCount(state: GameState): number {
  return Math.max(0, housingCapacity(state) - usedBeds(state));
}

export function homelessCount(state: GameState): number {
  return state.villagers.length - usedBeds(state);
}

export function occupantsForHouse(state: GameState, houseId: string): Villager[] {
  return state.villagers.filter((villager) => villager.homeId === houseId);
}

export function hasValidHome(state: GameState, villager: Villager): boolean {
  return !!villager.homeId && completedHouses(state).some((house) => house.id === villager.homeId);
}

export function findHouseWithOpenBed(
  state: GameState,
  point: { x: number; y: number },
  providedOccupancy?: Map<string, number>
): Building | undefined {
  const houses = completedHouses(state);
  const occupancy = providedOccupancy ?? occupancyByHouse(state, houses);
  return houses
    .filter((house) => (occupancy.get(house.id) ?? 0) < house.capacity)
    .sort((a, b) => distance(buildingMidpoint(a), point) - distance(buildingMidpoint(b), point))[0];
}

function completedHouses(state: GameState): Building[] {
  return state.buildings.filter((building) => building.type === "house" && building.status === "complete");
}

function occupancyByHouse(state: GameState, houses: Building[]): Map<string, number> {
  const validHomes = new Set(houses.map((house) => house.id));
  const occupancy = new Map<string, number>();
  for (const house of houses) occupancy.set(house.id, 0);
  for (const villager of state.villagers) {
    if (!villager.homeId || !validHomes.has(villager.homeId)) continue;
    occupancy.set(villager.homeId, (occupancy.get(villager.homeId) ?? 0) + 1);
  }
  return occupancy;
}

function buildingMidpoint(building: Building): { x: number; y: number } {
  return {
    x: building.x + building.width / 2,
    y: building.y + building.height / 2
  };
}
