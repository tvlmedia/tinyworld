import { Pathfinder } from "../ai/Pathfinding";
import { assignJobByIndex } from "../ai/Jobs";
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
  | { kind: "building"; id: string };

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
  natureCursor: number;
  lastAutosaveAt: number;
  debug: DebugState;
  buildingEffects: BuildingEffects;
  civilization: CivilizationState;
}

export const DEFAULT_SETTINGS: SettingsState = {
  interfaceScale: 1,
  particles: "medium",
  shadows: true,
  weatherAnimations: true,
  reducedMotion: false,
  soundEnabled: false,
  autosave: true,
  dayNightSpeed: 1
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
    natureCursor: 0,
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
    civilization: defaultCivilizationState()
  };

  state.events.push({
    id: ids.next("event"),
    day: 1,
    text: `${world.name} ontwaakt rond een klein kampvuur.`,
    time: state.time.minutes
  });

  return state;
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
  state.buildingEffects.woodBonus = state.buildings.some((building) => building.type === "woodcutter" && building.status === "complete");
  state.buildingEffects.workshopBonus = state.buildings.some((building) => building.type === "workshop" && building.status === "complete");
  state.buildingEffects.mineBonus = state.buildings.some((building) => building.type === "mine" && building.status === "complete");
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
