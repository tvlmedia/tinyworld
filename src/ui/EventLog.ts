import { GameState } from "../app/GameState";
import { formattedClock } from "../simulation/TimeSystem";

export function eventLogHtml(state: GameState): string {
  return state.events
    .slice(0, 8)
    .map((event) => `<li><span>Dag ${event.day} ${formattedClock(event.time)}</span>${event.text}</li>`)
    .join("");
}
