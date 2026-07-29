import { GameState } from "../app/GameState";

const MINUTES_PER_DAY = 24 * 60;

export function updateTime(state: GameState, dt: number): void {
  const previousDay = state.time.day;
  state.time.minutes += dt * 10 * state.settings.dayNightSpeed;
  while (state.time.minutes >= MINUTES_PER_DAY) {
    state.time.minutes -= MINUTES_PER_DAY;
    state.time.day += 1;
  }
  state.time.isNight = state.time.minutes < 6 * 60 || state.time.minutes > 20 * 60;
  if (state.time.day !== previousDay) {
    state.populationTimer += 8;
  }
}

export function formattedClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export function daylightAmount(minutes: number): number {
  const hour = minutes / 60;
  if (hour < 5 || hour > 22) return 0.18;
  if (hour < 8) return 0.18 + ((hour - 5) / 3) * 0.82;
  if (hour > 18) return 1 - ((hour - 18) / 4) * 0.82;
  return 1;
}
