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
