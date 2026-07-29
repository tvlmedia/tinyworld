import { updateVillager } from "../ai/VillagerBrain";
import { refreshBuildingEffects, GameState } from "../app/GameState";
import { updateFire } from "./FireSystem";
import { updateNature } from "./NatureSystem";
import { updatePopulation } from "./PopulationSystem";
import { updateSettlementPlanner } from "./SettlementPlanner";
import { updateTime } from "./TimeSystem";
import { updateWeather } from "./WeatherSystem";

export class Simulation {
  update(state: GameState, dt: number): void {
    const started = performance.now();
    updateTime(state, dt);
    updateWeather(state, dt);
    updateNature(state, dt);
    updateSettlementPlanner(state, dt);
    for (const villager of state.villagers) {
      updateVillager(villager, state, dt);
    }
    updateProduction(state, dt);
    updatePopulation(state, dt);
    updateFire(state, dt);
    updateCooldowns(state, dt);
    refreshBuildingEffects(state);
    state.debug.tickMs = performance.now() - started;
    state.debug.activePaths = state.pathfinder.activePathCount;
    state.debug.lastVisitedNodes = state.pathfinder.lastVisitedNodes;
    state.pathfinder.activePathCount = 0;
  }
}

function updateProduction(state: GameState, dt: number): void {
  for (const building of state.buildings) {
    if (building.status !== "complete") continue;
    if (building.type === "farm") {
      building.productionTimer += dt;
      if (building.productionTimer >= 12) {
        building.productionTimer = 0;
        const rainBonus = state.weather.current === "rain" ? 2 : state.weather.current === "drought" ? -1 : 0;
        state.resources.food += Math.max(1, 3 + rainBonus);
      }
    }
  }
}

function updateCooldowns(state: GameState, dt: number): void {
  for (const cooldown of state.toolCooldowns) {
    cooldown.remaining = Math.max(0, cooldown.remaining - dt);
  }
}
