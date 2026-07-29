import { updateVillager } from "../ai/VillagerBrain";
import { refreshBuildingEffects, GameState } from "../app/GameState";
import { updateCivilization } from "./CivilizationSystem";
import { updateDiplomacyAndTrade } from "./DiplomacySystem";
import { updateExpansion } from "./ExpansionSystem";
import { updateFire } from "./FireSystem";
import { updateEmergencyResponse } from "./EmergencyResponseSystem";
import { updateHousing } from "./HousingSystem";
import { updateHousingUpgrades } from "./HousingUpgradeSystem";
import { updateNature } from "./NatureSystem";
import { updatePopulation } from "./PopulationSystem";
import { updateSettlementPlanner } from "./SettlementPlanner";
import { updateStability } from "./StabilitySystem";
import { updateTechnology } from "./TechnologySystem";
import { updateTime } from "./TimeSystem";
import { updateWarfare } from "./WarfareSystem";
import { updateWeather } from "./WeatherSystem";
import { Building } from "../entities/Building";
import { getTile } from "../world/World";

export class Simulation {
  update(state: GameState, dt: number): void {
    const started = performance.now();
    updateTime(state, dt);
    updateWeather(state, dt);
    updateNature(state, dt);
    updateHousing(state);
    updateHousingUpgrades(state, dt);
    updateSettlementPlanner(state, dt);
    for (const villager of state.villagers) {
      updateVillager(villager, state, dt);
    }
    updateProduction(state, dt);
    updatePopulation(state, dt);
    updateCivilization(state, dt);
    updateExpansion(state, dt);
    updateTechnology(state, dt);
    updateDiplomacyAndTrade(state, dt);
    updateWarfare(state, dt);
    updateStability(state, dt);
    updateFire(state, dt);
    updateEmergencyResponse(state, dt);
    updateHousing(state);
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
    if (building.status !== "complete" || !building.civilizationId) continue;
    building.productionTimer += dt;
    if (building.type === "mine" && building.productionTimer >= 36) {
      building.productionTimer = 0;
      refreshMineVein(state, building);
    } else if (building.type === "forestry" && building.productionTimer >= 24) {
      building.productionTimer = 0;
      tendManagedForest(state, building);
    } else if (building.type === "school" && building.productionTimer >= 30) {
      building.productionTimer = 0;
      for (const villager of state.villagers) {
        villager.happiness = Math.min(100, villager.happiness + 0.8);
      }
    }
  }
}

function tendManagedForest(state: GameState, forestry: Building): void {
  const candidates = [];
  for (let y = forestry.y - 8; y < forestry.y + forestry.height + 8; y += 1) {
    for (let x = forestry.x - 8; x < forestry.x + forestry.width + 8; x += 1) {
      const tile = getTile(state.world, x, y);
      if (!tile || tile.occupiedByBuildingId) continue;
      if (tile.type === "forest" && tile.resourceAmount < 7) candidates.push(tile);
    }
  }
  if (candidates.length === 0) return;
  candidates.sort((a, b) => a.resourceAmount - b.resourceAmount);
  const workers = state.villagers.filter(
    (villager) => villager.job === "woodcutter" && (!forestry.settlementId || villager.settlementId === forestry.settlementId)
  ).length;
  if (workers === 0) return;
  const plotsTended = Math.min(candidates.length, Math.max(1, Math.min(4, workers)));
  for (let index = 0; index < plotsTended; index += 1) candidates[index].resourceAmount += 1;
  state.world.version += 1;
}

function refreshMineVein(state: GameState, mine: Building): void {
  let fallback: { x: number; y: number } | undefined;
  for (let y = mine.y - 3; y < mine.y + mine.height + 3; y += 1) {
    for (let x = mine.x - 3; x < mine.x + mine.width + 3; x += 1) {
      const tile = getTile(state.world, x, y);
      if (!tile || tile.occupiedByBuildingId || tile.type === "water" || tile.type === "deepWater" || tile.type === "mountain" || tile.type === "road") {
        continue;
      }
      if (tile.type === "rock") {
        if (tile.resourceAmount < 8) {
          tile.resourceAmount += 1;
          state.world.version += 1;
        }
        return;
      }
      if (!fallback && (tile.type === "grass" || tile.type === "sand" || tile.type === "burned")) {
        fallback = { x, y };
      }
    }
  }

  if (!fallback) return;
  const tile = getTile(state.world, fallback.x, fallback.y);
  if (!tile) return;
  tile.type = "rock";
  tile.resourceAmount = 4;
  state.world.version += 1;
  state.pathfinder.clear();
}

function updateCooldowns(state: GameState, dt: number): void {
  for (const cooldown of state.toolCooldowns) {
    cooldown.remaining = Math.max(0, cooldown.remaining - dt);
  }
}
