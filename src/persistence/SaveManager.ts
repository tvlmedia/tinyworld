import { GameState, DEFAULT_SETTINGS, SettingsState } from "../app/GameState";
import { IdGenerator } from "../utils/IdGenerator";
import { Pathfinder } from "../ai/Pathfinding";
import { SeededRandom } from "../world/SeededRandom";
import { deserializeWorld, SaveGame, serializeGame } from "./Serialization";
import { migrateSaveGame } from "./SaveMigrations";
import { refreshBuildingEffects } from "../app/GameState";

const SAVE_PREFIX = "tinyworld:slot:";
const AUTOSAVE_KEY = "tinyworld:autosave";
const SETTINGS_KEY = "tinyworld:settings";

export interface SaveMeta {
  slot: number;
  seed: string;
  day: number;
  savedAt: number;
}

export class SaveManager {
  saveSlot(slot: number, state: GameState): boolean {
    return this.write(`${SAVE_PREFIX}${slot}`, serializeGame(state));
  }

  loadSlot(slot: number): SaveGame | undefined {
    return this.read(`${SAVE_PREFIX}${slot}`);
  }

  saveAutosave(state: GameState): boolean {
    return this.write(AUTOSAVE_KEY, serializeGame(state));
  }

  loadAutosave(): SaveGame | undefined {
    return this.read(AUTOSAVE_KEY);
  }

  listSlots(): SaveMeta[] {
    const metas: SaveMeta[] = [];
    for (let slot = 1; slot <= 3; slot += 1) {
      const save = this.loadSlot(slot);
      if (save) metas.push({ slot, seed: save.world.seed, day: save.time.day, savedAt: save.savedAt });
    }
    return metas;
  }

  saveSettings(settings: SettingsState): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Settings are optional; failing storage should not stop the game.
    }
  }

  loadSettings(): SettingsState {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as SettingsState;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  restoreState(save: SaveGame): GameState {
    const migrated = migrateSaveGame(save);
    const ids = new IdGenerator();
    for (const building of migrated.buildings) ids.observe(building.id);
    for (const villager of migrated.villagers) ids.observe(villager.id);
    for (const event of migrated.events) ids.observe(event.id);
    const state: GameState = {
      world: deserializeWorld(migrated.world),
      rng: new SeededRandom(`${migrated.world.seed}:simulation:${migrated.time.day}:${Math.floor(migrated.time.minutes)}`),
      ids,
      pathfinder: new Pathfinder(),
      villagers: migrated.villagers,
      buildings: migrated.buildings,
      resources: migrated.resources,
      time: migrated.time,
      weather: migrated.weather,
      fires: migrated.fires,
      events: migrated.events,
      selected: { kind: "none" },
      activeTool: "inspect",
      toolCooldowns: [],
      settings: { ...DEFAULT_SETTINGS, ...migrated.settings },
      plannerTimer: 8,
      populationTimer: 0,
      natureCursor: 0,
      lastAutosaveAt: Date.now(),
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
        workshopBonus: false
      }
    };
    refreshBuildingEffects(state);
    return state;
  }

  private write(key: string, save: SaveGame): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(save));
      return true;
    } catch {
      return false;
    }
  }

  private read(key: string): SaveGame | undefined {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      return migrateSaveGame(JSON.parse(raw) as SaveGame);
    } catch {
      return undefined;
    }
  }
}
