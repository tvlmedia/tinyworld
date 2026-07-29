export const FIRE_BALANCE = {
  simulationInterval: 0.25,
  maxActiveCells: 96,
  maxNewCellsPerUpdate: 12,
  normalSpreadChance: 0.14,
  droughtSpreadChance: 0.34,
  rainSpreadChance: 0.025,
  riotArsonThreshold: 118,
  riotArsonChance: 0.08,
  collapseMaxIgnitions: 4,
  captureMaxIgnitions: 2
} as const;
