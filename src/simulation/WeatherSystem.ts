import { GameState, WeatherType } from "../app/GameState";
import { addEvent } from "./EventSystem";

const WEATHER_LABELS: Record<WeatherType, string> = {
  clear: "helder",
  cloudy: "bewolkt",
  rain: "regen",
  storm: "onweer",
  drought: "droogte"
};

export function updateWeather(state: GameState, dt: number): void {
  state.weather.timer -= dt;
  state.weather.cloudOffset += dt * 4;
  state.weather.lightningFlash = Math.max(0, state.weather.lightningFlash - dt * 2.5);

  if (state.weather.current === "drought") state.weather.droughtDays += dt / 180;
  else state.weather.droughtDays = Math.max(0, state.weather.droughtDays - dt / 120);

  if (state.weather.timer <= 0) {
    const previous = state.weather.current;
    state.weather.current = chooseWeather(state);
    state.weather.timer = state.rng.float(70, 170);
    if (state.weather.current !== previous) {
      addEvent(state, `Het weer wordt ${WEATHER_LABELS[state.weather.current]}.`);
    }
  }

  if (state.weather.current === "storm" && state.rng.chance(dt * 0.018)) {
    state.weather.lightningFlash = 1;
  }
}

export function forceWeather(state: GameState, weather: WeatherType, seconds = 95): void {
  state.weather.current = weather;
  state.weather.timer = seconds;
  addEvent(state, `Je riep ${WEATHER_LABELS[weather]} op.`);
}

function chooseWeather(state: GameState): WeatherType {
  const roll = state.rng.next();
  if (state.weather.droughtDays > 0.6 && roll < 0.28) return "rain";
  if (roll < 0.42) return "clear";
  if (roll < 0.62) return "cloudy";
  if (roll < 0.8) return "rain";
  if (roll < 0.9) return "storm";
  return "drought";
}

export function weatherLabel(weather: WeatherType): string {
  return WEATHER_LABELS[weather];
}
