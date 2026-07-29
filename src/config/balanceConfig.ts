export const CIVILIZATION_UPDATE_INTERVALS = {
  settlementEconomy: 18,
  civilizationStrategy: 72,
  diplomacy: 96,
  research: 48,
  territory: 40,
  war: 64,
  trade: 36,
  history: 12,
  development: 12
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
  minDistance: 50,
  minSettlementDistanceTiles: 50,
  maxDistance: 96,
  baseSettlementTarget: 5,
  settlementsPer128Tiles: 2,
  expansionistBonusSettlements: 3,
  maxActiveGroupsPerCivilization: 2,
  searchAttemptsPerOrigin: 72,
  siteScoreThreshold: 12
} as const;

export const MIN_SETTLEMENT_DISTANCE_TILES = COLONIZATION.minSettlementDistanceTiles;

export const SETTLEMENT_GROWTH = {
  baseHousingReserve: 6,
  housingReserveRatio: 0.2,
  settlementsPerPlannerProject: 3,
  maxPlannerProjectsPerCycle: 8,
  settlementsPerUpgrade: 4,
  maxHousingUpgradesPerCycle: 6,
  populationPerFarm: 12,
  maxFarmsPerSettlement: 24,
  populationPerForestry: 60,
  maxForestryPerSettlement: 6,
  populationPerStorage: 45,
  maxBuildingRadius: 58
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
