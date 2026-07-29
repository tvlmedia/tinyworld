import { BuildingType } from "../entities/Building";
import { Civilization, Settlement, SettlementTier } from "../entities/Civilization";
import { ResourceStore } from "../entities/Resources";

export type DevelopmentStage =
  | "camp"
  | "hamlet"
  | "village"
  | "fortifiedVillage"
  | "city"
  | "capital"
  | "kingdom"
  | "empire";

export interface DevelopmentStageDefinition {
  id: DevelopmentStage;
  label: string;
  minPopulation: number;
  minSettlements: number;
  minCapitalTier: SettlementTier;
  unlocks: BuildingType[];
}

export const DEVELOPMENT_STAGES: DevelopmentStageDefinition[] = [
  { id: "camp", label: "Kamp", minPopulation: 0, minSettlements: 1, minCapitalTier: "camp", unlocks: ["campfire", "house"] },
  { id: "hamlet", label: "Gehucht", minPopulation: 10, minSettlements: 1, minCapitalTier: "hamlet", unlocks: ["storage", "well"] },
  {
    id: "village",
    label: "Dorp",
    minPopulation: 28,
    minSettlements: 1,
    minCapitalTier: "village",
    unlocks: ["farm", "woodcutter", "workshop", "mine"]
  },
  {
    id: "fortifiedVillage",
    label: "Versterkt dorp",
    minPopulation: 70,
    minSettlements: 1,
    minCapitalTier: "town",
    unlocks: ["wall", "gate", "watchtower"]
  },
  {
    id: "city",
    label: "Stad",
    minPopulation: 110,
    minSettlements: 1,
    minCapitalTier: "city",
    unlocks: ["market", "barracks", "reservoir"]
  },
  {
    id: "capital",
    label: "Hoofdstad",
    minPopulation: 150,
    minSettlements: 1,
    minCapitalTier: "capital",
    unlocks: ["castle", "firestation", "school"]
  },
  {
    id: "kingdom",
    label: "Koninkrijk",
    minPopulation: 210,
    minSettlements: 2,
    minCapitalTier: "capital",
    unlocks: ["harbor", "monument"]
  },
  {
    id: "empire",
    label: "Rijk",
    minPopulation: 340,
    minSettlements: 4,
    minCapitalTier: "capital",
    unlocks: ["castle", "wall", "gate", "barracks"]
  }
];

export const CASTLE_LEVELS = [
  { level: 1, label: "houten fort", stage: "fortifiedVillage", costs: { wood: 72, stone: 48, food: 18 } },
  { level: 2, label: "stenen fort", stage: "city", costs: { wood: 36, stone: 70, food: 12 } },
  { level: 3, label: "klein kasteel", stage: "capital", costs: { wood: 42, stone: 96, food: 18 } },
  { level: 4, label: "groot kasteel", stage: "kingdom", costs: { wood: 55, stone: 130, food: 24 } },
  { level: 5, label: "vesting", stage: "empire", costs: { wood: 70, stone: 180, food: 30 } }
] as const satisfies readonly {
  level: number;
  label: string;
  stage: DevelopmentStage;
  costs: ResourceStore;
}[];

export const DEVELOPMENT_UPDATE_INTERVAL = 12;

export function developmentStageFor(civilization: Civilization, settlements: Settlement[]): DevelopmentStageDefinition {
  const capital = settlements.find((settlement) => settlement.id === civilization.capitalSettlementId);
  const capitalTier = capital?.tier ?? "camp";
  const settlementCount = settlements.filter((settlement) => settlement.civilizationId === civilization.id).length;
  for (let index = DEVELOPMENT_STAGES.length - 1; index >= 0; index -= 1) {
    const stage = DEVELOPMENT_STAGES[index];
    if (civilization.population < stage.minPopulation) continue;
    if (settlementCount < stage.minSettlements) continue;
    if (tierRank(capitalTier) < tierRank(stage.minCapitalTier)) continue;
    return stage;
  }
  return DEVELOPMENT_STAGES[0];
}

export function developmentStageRank(stage: DevelopmentStage): number {
  return DEVELOPMENT_STAGES.findIndex((definition) => definition.id === stage);
}

function tierRank(tier: SettlementTier): number {
  return ["camp", "hamlet", "village", "town", "city", "capital"].indexOf(tier);
}
