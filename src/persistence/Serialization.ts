import { GAME_VERSION } from "../app/Config";
import { CivilizationState, GameState, WeatherState, FireState, TimeState, SettingsState } from "../app/GameState";
import { Building } from "../entities/Building";
import { ResourceStore } from "../entities/Resources";
import { Villager } from "../entities/Villager";
import { GameEvent } from "../simulation/EventSystem";
import { TILE_TYPES, Tile, TileType } from "../world/Tile";
import { World } from "../world/World";

export interface SerializedTile {
  t: number;
  e: number;
  m: number;
  f: number;
  p: number;
  r: number;
  b?: string;
}

export interface SerializedWorld {
  seed: string;
  name: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  version: number;
  tiles: SerializedTile[];
}

export interface SaveGame {
  version: number;
  savedAt: number;
  world: SerializedWorld;
  villagers: Villager[];
  buildings: Building[];
  resources: ResourceStore;
  time: TimeState;
  weather: WeatherState;
  fires: FireState[];
  events: GameEvent[];
  settings: SettingsState;
  civilization?: CivilizationState;
}

export function serializeGame(state: GameState): SaveGame {
  return {
    version: GAME_VERSION,
    savedAt: Date.now(),
    world: serializeWorld(state.world),
    villagers: state.villagers,
    buildings: state.buildings,
    resources: state.resources,
    time: state.time,
    weather: state.weather,
    fires: state.fires,
    events: state.events,
    settings: state.settings,
    civilization: state.civilization
  };
}

export function serializeWorld(world: World): SerializedWorld {
  return {
    seed: world.seed,
    name: world.name,
    width: world.width,
    height: world.height,
    spawn: world.spawn,
    version: world.version,
    tiles: world.tiles.map((tile) => ({
      t: TILE_TYPES.indexOf(tile.type),
      e: round(tile.elevation),
      m: round(tile.moisture),
      f: round(tile.fertility),
      p: round(tile.temperature),
      r: tile.resourceAmount,
      b: tile.occupiedByBuildingId
    }))
  };
}

export function deserializeWorld(serialized: SerializedWorld): World {
  const tiles: Tile[] = serialized.tiles.map((tile, index) => {
    const x = index % serialized.width;
    const y = Math.floor(index / serialized.width);
    return {
      x,
      y,
      type: tileTypeFromIndex(tile.t),
      elevation: tile.e,
      moisture: tile.m,
      fertility: tile.f,
      temperature: tile.p,
      resourceAmount: tile.r,
      occupiedByBuildingId: tile.b
    };
  });
  return {
    seed: serialized.seed,
    name: serialized.name,
    width: serialized.width,
    height: serialized.height,
    spawn: serialized.spawn,
    version: serialized.version,
    tiles
  };
}

function tileTypeFromIndex(index: number): TileType {
  return TILE_TYPES[index] ?? "grass";
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
