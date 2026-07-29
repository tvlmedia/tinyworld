export const DIPLOMACY = {
  discoveryDistance: 58,
  friendlyThreshold: 35,
  hostileThreshold: -35,
  allianceThreshold: 72,
  tradeMinimumOpinion: -12,
  relationDrift: 2.5
} as const;

export const TRADE = {
  maxRouteDistance: 72,
  caravanSpeed: 0.018,
  tradeValueBase: 8,
  wealthPerDelivery: 4,
  researchSpread: 1.2
} as const;
