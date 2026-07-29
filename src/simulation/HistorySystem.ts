import { GameState, worldYear } from "../app/GameState";
import { HistoricalEventType } from "../entities/Civilization";
import { addEvent } from "./EventSystem";

export function addHistoricalEvent(
  state: GameState,
  type: HistoricalEventType,
  text: string,
  details: { civilizationId?: string; settlementId?: string; warId?: string; x?: number; y?: number } = {}
): void {
  const year = worldYear(state);
  const fullText = `Jaar ${year} - ${text}`;
  state.historicEvents.push({
    id: state.ids.next("history"),
    year,
    type,
    text: fullText,
    ...details
  });
  if (state.historicEvents.length > 240) state.historicEvents.splice(0, state.historicEvents.length - 240);
  addEvent(state, text);
}
