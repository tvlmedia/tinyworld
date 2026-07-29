import { GameState } from "../app/GameState";
import { BuildingType } from "../entities/Building";
import { addEvent } from "./EventSystem";

const CIVILIZATION_TITLES = ["Kamp", "Gehucht", "Dorp", "Stadje", "Beschaving"] as const;

export function updateCivilization(state: GameState, dt: number): void {
  const completed = completedCounts(state);
  const completedBuildings = state.buildings.filter((building) => building.status === "complete").length;
  const score =
    state.villagers.length +
    completedBuildings * 2 +
    state.civilization.prosperity / 18 +
    state.civilization.knowledge / 20 +
    state.civilization.culture / 24;
  const nextLevel = score >= 42 ? 4 : score >= 30 ? 3 : score >= 19 ? 2 : score >= 11 ? 1 : 0;

  state.civilization.prosperity = Math.min(
    100,
    state.civilization.prosperity +
      dt * (completed.market * 0.05 + completed.storage * 0.015 + completed.farm * 0.012 + completed.house * 0.008)
  );
  state.civilization.knowledge = Math.min(
    100,
    state.civilization.knowledge + dt * (completed.school * 0.065 + completed.workshop * 0.025 + completed.mine * 0.012)
  );
  state.civilization.culture = Math.min(
    100,
    state.civilization.culture + dt * (completed.monument * 0.08 + completed.watchtower * 0.018 + completed.market * 0.01)
  );

  if (nextLevel > state.civilization.level) {
    state.civilization.level = nextLevel;
    state.civilization.title = CIVILIZATION_TITLES[nextLevel];
    addEvent(state, `${state.world.name} groeide uit tot een ${state.civilization.title.toLowerCase()}.`);
  } else {
    state.civilization.title = CIVILIZATION_TITLES[state.civilization.level] ?? "Kamp";
  }

  state.civilization.nextGoal = nextCivilizationGoal(state, completed);

  if (completed.well > 0) {
    for (const villager of state.villagers) {
      villager.health = Math.min(100, villager.health + dt * 0.025);
    }
  }
  if (completed.market > 0 || completed.monument > 0) {
    const boost = dt * (completed.market * 0.018 + completed.monument * 0.02);
    for (const villager of state.villagers) {
      villager.happiness = Math.min(100, villager.happiness + boost);
    }
  }
}

function nextCivilizationGoal(state: GameState, completed: Record<BuildingType, number>): string {
  const bedCapacity = state.buildings
    .filter((building) => building.status === "complete" && building.type === "house")
    .reduce((sum, building) => sum + building.capacity, 0);
  if (completed.mine < 1) return "bouw een mijn";
  if (bedCapacity < state.villagers.length + 2) return "bouw meer huizen";
  if (completed.farm < Math.max(1, Math.ceil(state.villagers.length / 7))) return "leg meer boerderijen aan";
  if (completed.woodcutter < 1) return "bouw een houthakkershut";
  if (completed.well < 1) return "bouw een waterput";
  if (completed.workshop < 1) return "bouw een werkplaats";
  if (completed.market < 1) return "open een markt";
  if (completed.school < 1) return "bouw een school";
  if (completed.monument < 1) return "richt een monument op";
  return "laat de stad verder groeien";
}

function completedCounts(state: GameState): Record<BuildingType, number> {
  const counts: Record<BuildingType, number> = {
    campfire: 0,
    storage: 0,
    house: 0,
    woodcutter: 0,
    mine: 0,
    farm: 0,
    workshop: 0,
    watchtower: 0,
    well: 0,
    market: 0,
    school: 0,
    monument: 0
  };
  for (const building of state.buildings) {
    if (building.status === "complete") counts[building.type] += 1;
  }
  return counts;
}
