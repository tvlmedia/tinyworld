import { GameState, worldYear } from "../app/GameState";
import { HistoricalEventType } from "../entities/Civilization";

export interface WorldReport {
  year: number;
  civilizations: number;
  settlements: number;
  activeWars: number;
  activeArmies: number;
  population: number;
  totalCasualties: number;
  activeTradeRoutes: number;
  averageStability: number;
  leadingCivilizationName: string;
  eventCounts: Partial<Record<HistoricalEventType, number>>;
}

export function createWorldReport(state: GameState): WorldReport {
  const activeWars = state.wars.filter((war) => war.active);
  const civilizations = state.civilizations.filter((civilization) => civilization.population > 0 || civilization.settlementIds.length > 0);
  const leadingCivilization = civilizations
    .slice()
    .sort((a, b) => b.population + b.economicStrength + b.technologicalStrength - (a.population + a.economicStrength + a.technologicalStrength))[0];
  return {
    year: worldYear(state),
    civilizations: civilizations.length,
    settlements: state.settlements.length,
    activeWars: activeWars.length,
    activeArmies: state.armies.length,
    population: state.settlements.reduce((sum, settlement) => sum + settlement.population, 0),
    totalCasualties: state.wars.reduce((sum, war) => sum + war.casualties, 0),
    activeTradeRoutes: state.tradeRoutes.filter((route) => route.active).length,
    averageStability: average(state.civilizations.map((civilization) => civilization.stability)),
    leadingCivilizationName: leadingCivilization?.name ?? "-",
    eventCounts: countEvents(state)
  };
}

export function reportSummary(state: GameState): string {
  const report = createWorldReport(state);
  return `Jaar ${report.year}: ${report.civilizations} civs, ${report.settlements} nederzettingen, ${report.population} inwoners, ${report.activeWars} oorlogen, leider ${report.leadingCivilizationName}.`;
}

function countEvents(state: GameState): Partial<Record<HistoricalEventType, number>> {
  const counts: Partial<Record<HistoricalEventType, number>> = {};
  for (const event of state.historicEvents) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  return counts;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

