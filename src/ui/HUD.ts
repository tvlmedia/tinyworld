import { GameState } from "../app/GameState";
import { housingCapacity } from "../simulation/HousingSystem";
import { formattedClock } from "../simulation/TimeSystem";
import { weatherLabel } from "../simulation/WeatherSystem";

export function hudSummary(state: GameState): string {
  const totalPopulation = totalInhabitants(state);
  const totalBeds = totalHousingCapacity(state);
  const housedPopulation = Math.min(totalPopulation, totalBeds);
  const unhousedPopulation = Math.max(0, totalPopulation - totalBeds);
  const happiness = Math.round(
    state.villagers.reduce((sum, villager) => sum + villager.happiness, 0) / Math.max(1, state.villagers.length)
  );
  return `
    <div class="topbar__title">
      <strong>${state.world.name}</strong>
      <span>Seed: ${state.world.seed}</span>
      <span>Kaart: ${worldStyleLabel(state.world.generationStyle)}</span>
      <span>Fase: ${state.civilization.title}</span>
    </div>
    <div class="topbar__stats">
      <span>Dag ${state.time.day}</span>
      <span>${formattedClock(state.time.minutes)}</span>
      <span>${weatherLabel(state.weather.current)}</span>
      <span>${state.time.paused ? "Pauze" : `${state.time.speed}x`}</span>
    </div>
    <div class="resource-strip" aria-label="Dorpsvoorraad">
      <span>Inwoners <strong>${totalPopulation}</strong></span>
      <span>Actief <strong>${state.villagers.length}</strong></span>
      <span>Civs <strong>${state.civilizations.length}</strong></span>
      <span>Nederzettingen <strong>${state.settlements.length}</strong></span>
      <span>Oorlogen <strong>${state.wars.filter((war) => war.active).length}</strong></span>
      <span>Routes <strong>${state.tradeRoutes.filter((route) => route.active).length}</strong></span>
      <span>Bedden <strong>${housedPopulation}/${totalBeds}</strong></span>
      ${unhousedPopulation > 0 ? `<span>Geen huis <strong>${unhousedPopulation}</strong></span>` : ""}
      <span>Voedsel <strong>${Math.floor(state.resources.food)}</strong></span>
      <span>Hout <strong>${Math.floor(state.resources.wood)}</strong></span>
      <span>Steen <strong>${Math.floor(state.resources.stone)}</strong></span>
      <span>Gebouwen <strong>${state.buildings.length}</strong></span>
      <span>Geluk <strong>${happiness}</strong></span>
      <span>Kennis <strong>${Math.floor(state.civilization.knowledge)}</strong></span>
      <span>Welvaart <strong>${Math.floor(state.civilization.prosperity)}</strong></span>
      <span>Doel <strong>${state.civilization.nextGoal}</strong></span>
    </div>
  `;
}

function worldStyleLabel(style: GameState["world"]["generationStyle"]): string {
  if (style === "archipelago") return "Archipel";
  if (style === "islandChain") return "Eilandketen";
  if (style === "inlandSea") return "Binnenzee";
  return "Continent";
}

function totalInhabitants(state: GameState): number {
  const population = state.settlements.reduce((sum, settlement) => sum + settlement.population, 0);
  return population > 0 ? Math.round(population) : state.villagers.length;
}

function totalHousingCapacity(state: GameState): number {
  const beds = state.settlements.reduce((sum, settlement) => sum + settlement.housingCapacity, 0);
  return beds > 0 ? beds : housingCapacity(state);
}
