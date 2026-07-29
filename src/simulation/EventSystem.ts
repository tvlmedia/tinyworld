import { GameState } from "../app/GameState";

export interface GameEvent {
  id: string;
  day: number;
  text: string;
  time: number;
}

export function addEvent(state: GameState, text: string): void {
  const event: GameEvent = {
    id: state.ids.next("event"),
    day: state.time.day,
    text,
    time: state.time.minutes
  };
  state.events.unshift(event);
  state.events = state.events.slice(0, 32);
}

export function addEventDeduplicated(state: GameState, text: string, cooldownMinutes: number): boolean {
  const now = state.time.day * 1440 + state.time.minutes;
  const duplicate = state.events.some(
    (event) => event.text === text && now - (event.day * 1440 + event.time) < cooldownMinutes
  );
  if (duplicate) return false;
  addEvent(state, text);
  return true;
}
