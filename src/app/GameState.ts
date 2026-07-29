import { Pathfinder } from "../ai/Pathfinding";
import { assignJobByIndex } from "../ai/Jobs";
import { CIVILIZATION_PREFIXES, CIVILIZATION_SUFFIXES, CIVILIZATION_TRAITS, GOVERNMENT_BY_LEVEL, SETTLEMENT_PREFIXES, SETTLEMENT_SUFFIXES } from "../config/civilizationConfig";
import { CIVILIZATION_UPDATE_INTERVALS } from "../config/balanceConfig";
import {
  Army,
  Civilization,
  CivilizationGoal,
  CivilizationTimers,
  ColonistGroup,
  DiplomaticRelation,
  HistoricalEvent,
  MapMode,
  MigrationGroup,
  Settlement,
  TerritoryState,
  TradeRoute,
  War
} from "../entities/Civilization";
import { createBuilding, Building, BuildingType } from "../entities/Building";
import { ResourceStore } from "../entities/Resources";
import { createVillager, Villager, villagerName } from "../entities/Villager";
import { GameEvent } from "../simulation/EventSystem";
import { IdGenerator } from "../utils/IdGenerator";
import { Point } from "../utils/MathUtils";
import { DEFAULT_WORLD_SIZE, GameSpeed } from "./Config";
import { SeededRandom } from "../world/SeededRandom";
import { getTile, World } from "../world/World";
import { generateWorld } from "../world/WorldGenerator";

export type WeatherType = "clear" | "cloudy" | "rain" | "storm" | "drought";

export type Selection =
  | { kind: "none" }
  | { kind: "tile"; x: number; y: number }
  | { kind: "villager"; id: string }
  | { kind: "building"; id: string }
  | { kind: "settlement"; id: string };

export interface TimeState {
  day: number;
  minutes: number;
  speed: GameSpeed;
  paused: boolean;
  isNight: boolean;
}

export interface WeatherState {
  current: WeatherType;
  timer: number;
  droughtDays: number;
  lightningFlash: number;
  cloudOffset: number;
}

export interface FireState {
  x: number;
  y: number;
  intensity: number;
  fuel: number;
  spreadTimer: number;
}

export interface SettingsState {
  interfaceScale: number;
  particles: "low" | "medium" | "high";
  shadows: boolean;
  weatherAnimations: boolean;
  reducedMotion: boolean;
  soundEnabled: boolean;
  autosave: boolean;
  dayNightSpeed: number;
  settlementInfluence: boolean;
}

export interface ToolCooldown {
  tool: string;
  remaining: number;
}

export interface DebugState {
  enabled: boolean;
  fps: number;
  tickMs: number;
  activePaths: number;
  lastVisitedNodes: number;
  showChunks: boolean;
}

export interface BuildingEffects {
  woodBonus: boolean;
  workshopBonus: boolean;
  mineBonus: boolean;
}

export interface CivilizationState {
  level: number;
  title: string;
  prosperity: number;
  knowledge: number;
  culture: number;
  nextGoal: string;
}

export interface GameState {
  world: World;
  rng: SeededRandom;
  ids: IdGenerator;
  pathfinder: Pathfinder;
  villagers: Villager[];
  buildings: Building[];
  resources: ResourceStore;
  time: TimeState;
  weather: WeatherState;
  fires: FireState[];
  events: GameEvent[];
  selected: Selection;
  activeTool: string;
  toolCooldowns: ToolCooldown[];
  settings: SettingsState;
  plannerTimer: number;
  populationTimer: number;
  housingUpgradeTimer: number;
  natureCursor: number;
  burnedRecoveryCursor: number;
  lastAutosaveAt: number;
  debug: DebugState;
  buildingEffects: BuildingEffects;
  civilization: CivilizationState;
  mapMode: MapMode;
  selectedCivilizationId?: string;
  settlements: Settlement[];
  civilizations: Civilization[];
  diplomaticRelations: DiplomaticRelation[];
  wars: War[];
  armies: Army[];
  tradeRoutes: TradeRoute[];
  colonistGroups: ColonistGroup[];
  migrationGroups: MigrationGroup[];
  historicEvents: HistoricalEvent[];
  territory: TerritoryState;
  civilizationTimers: CivilizationTimers;
}

export const DEFAULT_SETTINGS: SettingsState = {
  interfaceScale: 1,
  particles: "medium",
  shadows: true,
  weatherAnimations: true,
  reducedMotion: false,
  soundEnabled: false,
  autosave: true,
  dayNightSpeed: 1,
  settlementInfluence: true
};

export function defaultCivilizationState(): CivilizationState {
  return {
    level: 0,
    title: "Kamp",
    prosperity: 0,
    knowledge: 0,
    culture: 0,
    nextGoal: "bouw het eerste huis"
  };
}

export function createNewGameState(seed: string, size = DEFAULT_WORLD_SIZE, settings: SettingsState = DEFAULT_SETTINGS): GameState {
  const world = generateWorld(seed, size);
  const rng = new SeededRandom(`${world.seed}:simulation`);
  const ids = new IdGenerator();
  const buildings: Building[] = [];
  const villagers: Villager[] = [];
  const campfire = createBuilding(ids.next("building"), "campfire", world.spawn.x - 1, world.spawn.y - 1, true);
  const storage = createBuilding(ids.next("building"), "storage", world.spawn.x + 2, world.spawn.y - 1, true);

  buildings.push(campfire, storage);
  occupyBuildingTiles(world, campfire);
  occupyBuildingTiles(world, storage);

  for (let index = 0; index < 5; index += 1) {
    const position = findNearbySpawn(world, world.spawn, index);
    villagers.push(
      createVillager(ids.next("villager"), villagerName(index), position.x + 0.5, position.y + 0.5, assignJobByIndex(index), rng.int(18, 48))
    );
  }

  const state: GameState = {
    world,
    rng,
    ids,
    pathfinder: new Pathfinder(),
    villagers,
    buildings,
    resources: { wood: 8, food: 42, stone: 0 },
    time: {
      day: 1,
      minutes: 8 * 60,
      speed: 1,
      paused: false,
      isNight: false
    },
    weather: {
      current: "clear",
      timer: 85,
      droughtDays: 0,
      lightningFlash: 0,
      cloudOffset: 0
    },
    fires: [],
    events: [],
    selected: { kind: "none" },
    activeTool: "inspect",
    toolCooldowns: [],
    settings: { ...settings },
    plannerTimer: 12,
    populationTimer: 0,
    housingUpgradeTimer: 24,
    natureCursor: 0,
    burnedRecoveryCursor: 0,
    lastAutosaveAt: 0,
    debug: {
      enabled: typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "true",
      fps: 0,
      tickMs: 0,
      activePaths: 0,
      lastVisitedNodes: 0,
      showChunks: false
    },
    buildingEffects: {
      woodBonus: false,
      workshopBonus: false,
      mineBonus: false
    },
    civilization: defaultCivilizationState(),
    mapMode: "normal",
    settlements: [],
    civilizations: [],
    diplomaticRelations: [],
    wars: [],
    armies: [],
    tradeRoutes: [],
    colonistGroups: [],
    migrationGroups: [],
    historicEvents: [],
    territory: createEmptyTerritory(world),
    civilizationTimers: defaultCivilizationTimers()
  };

  bootstrapCivilizationState(state);

  state.events.push({
    id: ids.next("event"),
    day: 1,
    text: `${world.name} ontwaakt rond een klein kampvuur.`,
    time: state.time.minutes
  });

  return state;
}

export function defaultCivilizationTimers(): CivilizationTimers {
  return {
    settlementEconomy: CIVILIZATION_UPDATE_INTERVALS.settlementEconomy,
    civilizationStrategy: CIVILIZATION_UPDATE_INTERVALS.civilizationStrategy,
    diplomacy: CIVILIZATION_UPDATE_INTERVALS.diplomacy,
    research: CIVILIZATION_UPDATE_INTERVALS.research,
    territory: 0,
    war: CIVILIZATION_UPDATE_INTERVALS.war,
    trade: CIVILIZATION_UPDATE_INTERVALS.trade,
    history: CIVILIZATION_UPDATE_INTERVALS.history
  };
}

export function createEmptyTerritory(world: World): TerritoryState {
  return {
    version: 0,
    dirty: true,
    recalculationTimer: 0,
    ownerByTile: Array.from({ length: world.width * world.height }, () => null)
  };
}

export function bootstrapCivilizationState(state: GameState): void {
  if (state.civilizations.length > 0) return;

  const year = worldYear(state);
  const settlementId = state.ids.next("settlement");
  const civilizationId = state.ids.next("civilization");
  const civRng = state.rng.fork(`civilization:${state.world.seed}`);
  const settlementName = uniqueName(`${civRng.pick(SETTLEMENT_PREFIXES)}${civRng.pick(SETTLEMENT_SUFFIXES)}`, state.settlements.map((settlement) => settlement.name));
  const civilizationName = uniqueName(`${civRng.pick(CIVILIZATION_PREFIXES)} ${civRng.pick(CIVILIZATION_SUFFIXES)}`, state.civilizations.map((civilization) => civilization.name));
  const firstTrait = civRng.pick(CIVILIZATION_TRAITS);
  const secondTrait = civRng.pick(CIVILIZATION_TRAITS.filter((trait) => trait !== firstTrait));
  const traits = civRng.chance(0.6) ? [firstTrait, secondTrait] : [firstTrait];

  const buildingIds = state.buildings.map((building) => building.id);
  const residentIds = state.villagers.map((villager) => villager.id);
  for (const building of state.buildings) {
    building.civilizationId = civilizationId;
    building.settlementId = settlementId;
  }
  for (const villager of state.villagers) {
    villager.civilizationId = civilizationId;
    villager.settlementId = settlementId;
  }

  const settlement: Settlement = {
    id: settlementId,
    civilizationId,
    name: settlementName,
    centerX: state.world.spawn.x,
    centerY: state.world.spawn.y,
    foundedYear: year,
    tier: "camp",
    population: state.villagers.length,
    abstractPopulation: 0,
    housingCapacity: 0,
    foodProduction: 0,
    woodProduction: 0,
    stoneProduction: 0,
    metalProduction: 0,
    scienceProduction: 0,
    wealthProduction: 0,
    happiness: 72,
    stability: 78,
    defense: 0,
    foodSecurity: 55,
    buildingIds,
    residentIds,
    connectedSettlementIds: [],
    localPriorities: ["housing", "food", "wood"],
    stockpile: { ...state.resources, metal: 0, tools: 0, wealth: 0, research: 0 },
    nextProject: "bouw het eerste huis"
  };

  const civilization: Civilization = {
    id: civilizationId,
    name: civilizationName,
    colorIndex: civRng.int(0, 7),
    foundedYear: year,
    government: GOVERNMENT_BY_LEVEL[0],
    traits,
    capitalSettlementId: settlementId,
    settlementIds: [settlementId],
    population: settlement.population,
    militaryStrength: 0,
    economicStrength: 0,
    technologicalStrength: 0,
    treasury: 0,
    storedResearch: 0,
    stability: settlement.stability,
    warSupport: traits.includes("militaristic") ? 42 : 24,
    prosperity: 0,
    foodSecurity: settlement.foodSecurity,
    knownCivilizationIds: [],
    activeWarIds: [],
    activeTreatyIds: [],
    unlockedTechnologyIds: ["fire", "gathering", "shelter"],
    currentResearchId: "agriculture",
    strategicGoals: ["buildHousing", "secureFood"]
  };

  state.settlements = [settlement];
  state.civilizations = [civilization];
  state.selectedCivilizationId = civilizationId;
  state.territory = createEmptyTerritory(state.world);
  state.territory.dirty = true;
  state.historicEvents.push({
    id: state.ids.next("history"),
    year,
    type: "civilizationFounded",
    civilizationId,
    settlementId,
    x: settlement.centerX,
    y: settlement.centerY,
    text: `Jaar ${year} - De ${civilization.name} stichtten ${settlement.name}.`
  });
}

export function worldYear(state: Pick<GameState, "time">): number {
  return Math.max(1, state.time.day);
}

function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let suffix = 2;
  while (existing.includes(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

export function occupyBuildingTiles(world: World, building: Building): void {
  for (let y = building.y; y < building.y + building.height; y += 1) {
    for (let x = building.x; x < building.x + building.width; x += 1) {
      const tile = getTile(world, x, y);
      if (tile) tile.occupiedByBuildingId = building.id;
    }
  }
  world.version += 1;
}

export function releaseBuildingTiles(world: World, building: Building): void {
  for (let y = building.y; y < building.y + building.height; y += 1) {
    for (let x = building.x; x < building.x + building.width; x += 1) {
      const tile = getTile(world, x, y);
      if (tile?.occupiedByBuildingId === building.id) tile.occupiedByBuildingId = undefined;
    }
  }
  world.version += 1;
}

export function refreshBuildingEffects(state: GameState): void {
  state.buildingEffects.woodBonus = state.buildings.some(
    (building) => building.type === "woodcutter" && building.status === "complete" && !!building.civilizationId
  );
  state.buildingEffects.workshopBonus = state.buildings.some(
    (building) => building.type === "workshop" && building.status === "complete" && !!building.civilizationId
  );
  state.buildingEffects.mineBonus = state.buildings.some(
    (building) => building.type === "mine" && building.status === "complete" && !!building.civilizationId
  );
}

function findNearbySpawn(world: World, spawn: Point, index: number): Point {
  const offsets = [
    { x: -2, y: 1 },
    { x: 1, y: 2 },
    { x: 3, y: 1 },
    { x: -3, y: -2 },
    { x: 0, y: -3 }
  ];
  const first = offsets[index % offsets.length];
  const preferred = { x: spawn.x + first.x, y: spawn.y + first.y };
  const tile = getTile(world, preferred.x, preferred.y);
  if (tile && !tile.occupiedByBuildingId && tile.type !== "water" && tile.type !== "deepWater" && tile.type !== "mountain") {
    return preferred;
  }
  for (let radius = 2; radius < 12; radius += 1) {
    for (let y = spawn.y - radius; y <= spawn.y + radius; y += 1) {
      for (let x = spawn.x - radius; x <= spawn.x + radius; x += 1) {
        const candidate = getTile(world, x, y);
        if (candidate && !candidate.occupiedByBuildingId && candidate.type !== "water" && candidate.type !== "deepWater" && candidate.type !== "mountain") {
          return { x, y };
        }
      }
    }
  }
  return spawn;
}

export function createBuildingAt(state: GameState, type: BuildingType, x: number, y: number, complete = false): Building {
  const building = createBuilding(state.ids.next("building"), type, x, y, complete);
  state.buildings.push(building);
  occupyBuildingTiles(state.world, building);
  return building;
}
