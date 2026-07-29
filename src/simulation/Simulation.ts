import { updateVillager } from "../ai/VillagerBrain";
import { refreshBuildingEffects, GameState } from "../app/GameState";
import { updateCivilization } from "./CivilizationSystem";
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
    updateCivilization(state, dt);
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
    building.productionTimer += dt;
    if (building.type === "farm") {
      if (building.productionTimer >= 9) {
        building.productionTimer = 0;
        const rainBonus = state.weather.current === "rain" ? 2 : state.weather.current === "drought" ? -1 : 0;
        state.resources.food += Math.max(2, 5 + rainBonus + Math.floor(state.civilization.prosperity / 35));
      }
    } else if (building.type === "woodcutter" && building.productionTimer >= 18) {
      building.productionTimer = 0;
      state.resources.wood += 5 + Math.floor(state.civilization.knowledge / 35);
    } else if (building.type === "workshop" && building.productionTimer >= 22) {
      building.productionTimer = 0;
      state.resources.stone += 2;
    } else if (building.type === "market" && building.productionTimer >= 16) {
      building.productionTimer = 0;
      state.resources.food += 2;
      state.resources.wood += 1;
    } else if (building.type === "school" && building.productionTimer >= 30) {
      building.productionTimer = 0;
      for (const villager of state.villagers) {
        villager.happiness = Math.min(100, villager.happiness + 0.8);
      }
    }
  }
}

function updateCooldowns(state: GameState, dt: number): void {
  for (const cooldown of state.toolCooldowns) {
    cooldown.remaining = Math.max(0, cooldown.remaining - dt);
  }
}
