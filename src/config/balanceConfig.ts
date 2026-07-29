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
  baseFoodCost: 18,
  baseWoodCost: 12,
  settlers: 5,
  minCapitalPopulation: 18,
  minDistance: 22,
  maxDistance: 96,
  baseSettlementTarget: 5,
  settlementsPer128Tiles: 2,
  expansionistBonusSettlements: 3,
  maxActiveGroupsPerCivilization: 2,
  searchAttemptsPerOrigin: 72,
  siteScoreThreshold: 12
} as const;

export const ROAD_NETWORK = {
  maxLinksPerStrategyTick: 4,
  maxPathNodes: 24_000,
  woodCostPerNewTile: 0.04,
  maxExtraLinkDistance: 82
} as const;

export const MACRO_ECONOMY = {
  foodConsumptionPerPerson: 0.09,
  wealthMaintenancePerBuilding: 0.04,
  researchFromPopulation: 0.008
} as const;
