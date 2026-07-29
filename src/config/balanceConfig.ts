export const CIVILIZATION_UPDATE_INTERVALS = {
  settlementEconomy: 18,
  civilizationStrategy: 72,
  diplomacy: 96,
  research: 48,
  territory: 40,
  war: 64,
  trade: 36,
  history: 12
} as const;

export const TERRITORY = {
  baseSettlementInfluence: 8,
  tierInfluence: 4,
  populationDivisor: 18,
  dominanceThreshold: 4
} as const;

export const COLONIZATION = {
  baseFoodCost: 24,
  baseWoodCost: 16,
  settlers: 4,
  minCapitalPopulation: 14,
  minDistance: 18,
  maxDistance: 44
} as const;

export const MACRO_ECONOMY = {
  foodConsumptionPerPerson: 0.09,
  wealthMaintenancePerBuilding: 0.04,
  researchFromPopulation: 0.008
} as const;
