import { GameState } from "../app/GameState";
import { TECHNOLOGIES, TECHNOLOGIES_BY_ID, TechnologyDefinition, TechnologyUnlock } from "../config/technologyConfig";
import { BuildingType } from "../entities/Building";
import { Civilization, Settlement } from "../entities/Civilization";
import { addHistoricalEvent } from "./HistorySystem";

const BUILDING_TECH_REQUIREMENTS: Partial<Record<BuildingType, string>> = {
  forestry: "woodworking",
  market: "markets",
  school: "writing",
  watchtower: "fortification",
  monument: "writing"
};

export function updateTechnology(state: GameState, dt: number): void {
  state.civilizationTimers.research -= dt;
  if (state.civilizationTimers.research > 0) return;
  state.civilizationTimers.research = 48;

  for (const civilization of state.civilizations) {
    const settlements = state.settlements.filter((settlement) => settlement.civilizationId === civilization.id);
    if (!civilization.currentResearchId || !isResearchAvailable(civilization, civilization.currentResearchId)) {
      civilization.currentResearchId = chooseResearch(state, civilization, settlements)?.id;
    }
    if (!civilization.currentResearchId) continue;
    const technology = TECHNOLOGIES_BY_ID[civilization.currentResearchId];
    if (!technology) continue;
    civilization.storedResearch += researchIncome(civilization, settlements);
    if (civilization.storedResearch < technology.researchCost) continue;
    civilization.storedResearch -= technology.researchCost;
    unlockTechnology(state, civilization, technology);
    civilization.currentResearchId = chooseResearch(state, civilization, settlements)?.id;
  }
}

export function chooseResearch(state: GameState, civilization: Civilization, settlements = state.settlements): TechnologyDefinition | undefined {
  const available = TECHNOLOGIES.filter((technology) => isResearchAvailable(civilization, technology.id));
  if (available.length === 0) return undefined;
  return available
    .map((technology) => ({
      technology,
      score: researchScore(state, civilization, settlements, technology) + state.rng.float(-2.5, 2.5)
    }))
    .sort((a, b) => b.score - a.score)[0]?.technology;
}

export function isResearchAvailable(civilization: Civilization, technologyId: string): boolean {
  const technology = TECHNOLOGIES_BY_ID[technologyId];
  if (!technology || civilization.unlockedTechnologyIds.includes(technology.id)) return false;
  return technology.prerequisites.every((prerequisite) => civilization.unlockedTechnologyIds.includes(prerequisite));
}

export function hasTechnology(civilization: Civilization | undefined, technologyId: string): boolean {
  return !!civilization && civilization.unlockedTechnologyIds.includes(technologyId);
}

export function isBuildingUnlocked(state: GameState, civilizationId: string | undefined, type: BuildingType): boolean {
  const requirement = BUILDING_TECH_REQUIREMENTS[type];
  if (!requirement || !civilizationId) return true;
  return hasTechnology(state.civilizations.find((civilization) => civilization.id === civilizationId), requirement);
}

export function economyMultiplier(civilization: Civilization | undefined, target: string): number {
  if (!civilization) return 1;
  let multiplier = 1;
  for (const technologyId of civilization.unlockedTechnologyIds) {
    const technology = TECHNOLOGIES_BY_ID[technologyId];
    if (!technology) continue;
    for (const unlock of technology.unlocks) {
      if (unlock.type === "economyBonus" && unlock.target === target && typeof unlock.value === "number") {
        multiplier *= unlock.value;
      }
    }
  }
  return multiplier;
}

function unlockTechnology(state: GameState, civilization: Civilization, technology: TechnologyDefinition): void {
  civilization.unlockedTechnologyIds.push(technology.id);
  for (const unlock of technology.unlocks) applyUnlock(state, civilization, unlock);
  addHistoricalEvent(state, "technologyUnlocked", `${civilization.name} ontdekten ${technology.name}.`, {
    civilizationId: civilization.id
  });
}

function applyUnlock(state: GameState, civilization: Civilization, unlock: TechnologyUnlock): void {
  if (unlock.type === "economyBonus" && unlock.target === "buildingHealth" && typeof unlock.value === "number") {
    for (const building of state.buildings) {
      if (building.civilizationId !== civilization.id) continue;
      building.maxHealth = Math.max(building.maxHealth, 100 + unlock.value);
      building.health = Math.min(building.maxHealth, building.health + unlock.value);
    }
  }
  if (unlock.type === "visualEra" && typeof unlock.value === "string") {
    for (const building of state.buildings) {
      if (building.civilizationId === civilization.id) building.visualEra = unlock.value;
    }
  }
}

function researchIncome(civilization: Civilization, settlements: Settlement[]): number {
  const population = settlements.reduce((sum, settlement) => sum + settlement.population, 0);
  const science = settlements.reduce((sum, settlement) => sum + settlement.scienceProduction, 0);
  const wealth = settlements.reduce((sum, settlement) => sum + settlement.wealthProduction, 0);
  const innovative = civilization.traits.includes("innovative") ? 1.28 : 1;
  const traded = civilization.activeTreatyIds.length > 0 ? 1.08 : 1;
  return (6 + population * 0.45 + science * 1.2 + wealth * 0.15) * innovative * traded;
}

function researchScore(state: GameState, civilization: Civilization, settlements: Settlement[], technology: TechnologyDefinition): number {
  let score = 10 + (technology.weights[civilization.traits[0]] ?? 0);
  for (const trait of civilization.traits) score += technology.weights[trait] ?? 0;
  if (technology.unlocks.some((unlock) => unlock.target === "food") && civilization.foodSecurity < 58) score += (70 - civilization.foodSecurity) * 0.9;
  if (technology.unlocks.some((unlock) => unlock.target === "wealth") && civilization.prosperity < 45) score += 10;
  if (technology.unlocks.some((unlock) => unlock.target === "research") && civilization.technologicalStrength < 55) score += 12;
  if (technology.unlocks.some((unlock) => unlock.target === "defense" || unlock.target === "armyStrength") && civilization.warSupport > 45) score += 14;
  if (technology.id === "roads" && settlements.some((settlement) => settlement.connectedSettlementIds.length === 0 && settlements.length > 1)) score += 16;
  if (technology.id === "markets" && settlements.some((settlement) => settlement.population > 24)) score += 12;
  if (technology.id === "masonry" && state.buildings.some((building) => building.civilizationId === civilization.id && building.health < building.maxHealth)) score += 8;
  return score;
}
