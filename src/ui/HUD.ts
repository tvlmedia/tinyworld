import { GameState } from "../app/GameState";
import { formattedClock } from "../simulation/TimeSystem";
import { weatherLabel } from "../simulation/WeatherSystem";

export function hudSummary(state: GameState): string {
  const happiness = Math.round(
    state.villagers.reduce((sum, villager) => sum + villager.happiness, 0) / Math.max(1, state.villagers.length)
  );
  return `
    <div class="topbar__title">
      <strong>${state.world.name}</strong>
      <span>Seed: ${state.world.seed}</span>
    </div>
    <div class="topbar__stats">
      <span>Dag ${state.time.day}</span>
      <span>${formattedClock(state.time.minutes)}</span>
      <span>${weatherLabel(state.weather.current)}</span>
      <span>${state.time.paused ? "Pauze" : `${state.time.speed}x`}</span>
    </div>
    <div class="resource-strip" aria-label="Dorpsvoorraad">
      <span>Bewoners <strong>${state.villagers.length}</strong></span>
      <span>Voedsel <strong>${Math.floor(state.resources.food)}</strong></span>
      <span>Hout <strong>${Math.floor(state.resources.wood)}</strong></span>
      <span>Steen <strong>${Math.floor(state.resources.stone)}</strong></span>
      <span>Gebouwen <strong>${state.buildings.length}</strong></span>
      <span>Geluk <strong>${happiness}</strong></span>
    </div>
  `;
}
