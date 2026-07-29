import { SettlementTier } from "../entities/Civilization";

export interface SettlementTierRule {
  tier: SettlementTier;
  minPopulation: number;
  minBuildings: number;
  minFoodSecurity: number;
  minDefense: number;
  requiredBuildings: string[];
  requiresConnection: boolean;
}

export const SETTLEMENT_TIER_RULES: SettlementTierRule[] = [
  {
    tier: "capital",
    minPopulation: 160,
    minBuildings: 16,
    minFoodSecurity: 75,
    minDefense: 35,
    requiredBuildings: ["market", "school", "workshop", "watchtower", "monument"],
    requiresConnection: true
  },
  {
    tier: "city",
    minPopulation: 120,
    minBuildings: 13,
    minFoodSecurity: 68,
    minDefense: 25,
    requiredBuildings: ["market", "school", "workshop", "watchtower"],
    requiresConnection: true
  },
  {
    tier: "town",
    minPopulation: 80,
    minBuildings: 10,
    minFoodSecurity: 62,
    minDefense: 12,
    requiredBuildings: ["market", "storage", "farm"],
    requiresConnection: true
  },
  {
    tier: "village",
    minPopulation: 28,
    minBuildings: 7,
    minFoodSecurity: 52,
    minDefense: 0,
    requiredBuildings: ["house", "farm", "storage"],
    requiresConnection: false
  },
  {
    tier: "hamlet",
    minPopulation: 10,
    minBuildings: 4,
    minFoodSecurity: 40,
    minDefense: 0,
    requiredBuildings: ["house"],
    requiresConnection: false
  },
  {
    tier: "camp",
    minPopulation: 0,
    minBuildings: 0,
    minFoodSecurity: 0,
    minDefense: 0,
    requiredBuildings: [],
    requiresConnection: false
  }
];

export const SETTLEMENT_TIER_LABELS: Record<SettlementTier, string> = {
  camp: "kamp",
  hamlet: "gehucht",
  village: "dorp",
  town: "stadje",
  city: "stad",
  capital: "hoofdstad"
};
