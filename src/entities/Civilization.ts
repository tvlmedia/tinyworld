import { ResourceStore } from "./Resources";

export type GovernmentType = "tribe" | "chiefdom" | "kingdom" | "republic" | "empire";

export type CivilizationTrait =
  | "agricultural"
  | "mercantile"
  | "militaristic"
  | "isolationist"
  | "expansionist"
  | "innovative"
  | "spiritual"
  | "industrious"
  | "seafaring";

export type CivilizationGoal =
  | "secureFood"
  | "buildHousing"
  | "expandTerritory"
  | "research"
  | "seekTrade"
  | "mobilizeArmy"
  | "defendBorders"
  | "stabilize";

export type SettlementTier = "camp" | "hamlet" | "village" | "town" | "city" | "capital";

export type SettlementPriority =
  | "food"
  | "housing"
  | "wood"
  | "stone"
  | "defense"
  | "wealth"
  | "science"
  | "infrastructure";

export type MapMode = "normal" | "political" | "diplomacy" | "resources" | "population" | "technology" | "war" | "trade";

export type StrategicResource = "food" | "wood" | "stone" | "metal" | "tools" | "wealth" | "research";

export type TechnologyEra = "survival" | "settlement" | "kingdom" | "engineering" | "industry";

export type DiplomaticStatus = "unknown" | "neutral" | "friendly" | "allied" | "hostile" | "atWar";

export type HistoricalEventType =
  | "civilizationFounded"
  | "settlementFounded"
  | "settlementUpgraded"
  | "technologyUnlocked"
  | "warStarted"
  | "battle"
  | "settlementCaptured"
  | "peaceSigned"
  | "civilizationCollapsed"
  | "rebellion"
  | "allianceFormed"
  | "goldenAge"
  | "famine"
  | "tradeRoute"
  | "colonization";

export type ArmyState = "mustering" | "moving" | "defending" | "raiding" | "besieging" | "retreating" | "disbanding";

export type WarGoal = "border" | "captureSettlement" | "resources" | "raid" | "defendAlly" | "independence";

export interface Civilization {
  id: string;
  name: string;
  colorIndex: number;
  foundedYear: number;
  government: GovernmentType;
  traits: CivilizationTrait[];
  capitalSettlementId: string;
  settlementIds: string[];
  population: number;
  militaryStrength: number;
  economicStrength: number;
  technologicalStrength: number;
  treasury: number;
  storedResearch: number;
  stability: number;
  warSupport: number;
  prosperity: number;
  foodSecurity: number;
  knownCivilizationIds: string[];
  activeWarIds: string[];
  activeTreatyIds: string[];
  unlockedTechnologyIds: string[];
  currentResearchId?: string;
  strategicGoals: CivilizationGoal[];
  debugDecision?: string;
}

export interface SettlementStockpile extends ResourceStore {
  metal: number;
  tools: number;
  wealth: number;
  research: number;
}

export interface Settlement {
  id: string;
  civilizationId: string;
  name: string;
  centerX: number;
  centerY: number;
  foundedYear: number;
  tier: SettlementTier;
  population: number;
  abstractPopulation: number;
  housingCapacity: number;
  foodProduction: number;
  woodProduction: number;
  stoneProduction: number;
  metalProduction: number;
  scienceProduction: number;
  wealthProduction: number;
  happiness: number;
  stability: number;
  defense: number;
  foodSecurity: number;
  buildingIds: string[];
  residentIds: string[];
  connectedSettlementIds: string[];
  localPriorities: SettlementPriority[];
  stockpile: SettlementStockpile;
  nextProject?: string;
}

export interface DiplomaticModifier {
  label: string;
  value: number;
  expiresYear?: number;
}

export interface DiplomaticRelation {
  civilizationAId: string;
  civilizationBId: string;
  opinionAOfB: number;
  opinionBOfA: number;
  trust: number;
  fear: number;
  tradeValue: number;
  status: DiplomaticStatus;
  grievances: DiplomaticModifier[];
  positiveModifiers: DiplomaticModifier[];
}

export interface War {
  id: string;
  attackerCivilizationIds: string[];
  defenderCivilizationIds: string[];
  startedYear: number;
  goal: WarGoal;
  targetSettlementId?: string;
  attackerWarScore: number;
  defenderWarScore: number;
  casualties: number;
  occupiedSettlementIds: string[];
  exhaustionByCivilizationId: Record<string, number>;
  active: boolean;
}

export interface Army {
  id: string;
  civilizationId: string;
  soldierIds: string[];
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  strength: number;
  morale: number;
  supplies: number;
  state: ArmyState;
  targetSettlementId?: string;
  warId?: string;
}

export interface TradeRoute {
  id: string;
  fromSettlementId: string;
  toSettlementId: string;
  civilizationAId: string;
  civilizationBId: string;
  goods: StrategicResource[];
  value: number;
  active: boolean;
  progress: number;
}

export interface ColonistGroup {
  id: string;
  civilizationId: string;
  originSettlementId: string;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  settlers: number;
  resources: ResourceStore;
  targetName: string;
  state: "preparing" | "traveling" | "founding" | "returning";
}

export interface MigrationGroup {
  id: string;
  fromSettlementId: string;
  toSettlementId: string;
  x: number;
  y: number;
  migrants: number;
  reason: string;
}

export interface HistoricalEvent {
  id: string;
  year: number;
  type: HistoricalEventType;
  text: string;
  civilizationId?: string;
  settlementId?: string;
  warId?: string;
  x?: number;
  y?: number;
}

export interface TerritoryState {
  version: number;
  dirty: boolean;
  recalculationTimer: number;
  ownerByTile: (string | null)[];
}

export interface CivilizationTimers {
  settlementEconomy: number;
  civilizationStrategy: number;
  diplomacy: number;
  research: number;
  territory: number;
  war: number;
  trade: number;
  history: number;
}
