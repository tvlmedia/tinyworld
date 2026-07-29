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

export type RecoveryState = "normal" | "stressed" | "emergency" | "recovering" | "collapseRisk";

export type RecoveryTaskType =
  | "extinguishFire"
  | "gatherFood"
  | "gatherWood"
  | "gatherStone"
  | "repairBuilding"
  | "clearRubble"
  | "rebuildBuilding"
  | "buildEmergency";

export type RecoveryTaskStatus = "queued" | "assigned" | "active" | "blocked" | "completed" | "cancelled";

export interface RecoveryTask {
  id: string;
  type: RecoveryTaskType;
  status: RecoveryTaskStatus;
  priority: number;
  createdDay: number;
  buildingId?: string;
  buildingType?: string;
  attempts: number;
  blockedReason?: string;
  retryAfterDay?: number;
}

export interface SettlementRecovery {
  state: RecoveryState;
  priorities: string[];
  tasks: RecoveryTask[];
  recentCrisisTimer: number;
  stableEvaluations: number;
  damagedBuildings: number;
  ruinedBuildings: number;
  stuckResidents: number;
  blockedReason?: string;
}

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
  | "settlementAbandoned"
  | "ruinsClaimed"
  | "peaceSigned"
  | "civilizationCollapsed"
  | "rebellion"
  | "allianceFormed"
  | "goldenAge"
  | "famine"
  | "tradeRoute"
  | "colonization"
  | "castleUpgraded"
  | "fortificationBuilt"
  | "siegeStarted"
  | "wallBreached";

export type ArmyState = "mustering" | "moving" | "defending" | "raiding" | "besieging" | "retreating" | "disbanding";

export type ArmyUnitType = "spearman" | "swordsman" | "archer" | "shieldBearer" | "rider";

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
  recovery?: SettlementRecovery;
}

export function createSettlementRecovery(): SettlementRecovery {
  return {
    state: "normal",
    priorities: [],
    tasks: [],
    recentCrisisTimer: 0,
    stableEvaluations: 0,
    damagedBuildings: 0,
    ruinedBuildings: 0,
    stuckResidents: 0
  };
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
  occupationPolicy: "annex" | "plunder";
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
  unitComposition: Partial<Record<ArmyUnitType, number>>;
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
  siegeProgress?: number;
  siegePhase?: "camp" | "encircling" | "assaulting" | "breached";
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
  transport?: "land" | "sea";
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
  transport?: "land" | "sea";
}

export interface MigrationGroup {
  id: string;
  fromSettlementId: string;
  toSettlementId: string;
  x: number;
  y: number;
  migrants: number;
  reason: string;
  transport?: "land" | "sea";
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
  development: number;
  recovery: number;
}
