import { GAME_VERSION } from "../app/Config";
import { SaveGame } from "./Serialization";

export function migrateSaveGame(save: SaveGame): SaveGame {
  if (!save || typeof save.version !== "number") {
    throw new Error("Savegame mist een versienummer.");
  }
  if (save.version > GAME_VERSION) {
    throw new Error("Savegame komt uit een nieuwere versie.");
  }
  let migrated = save;
  if (migrated.version === 0) {
    migrated = { ...migrated, version: 1 };
  }
  if (migrated.version === 1) {
    migrated = { ...migrated, version: 2 };
  }
  if (migrated.version === 2) {
    migrated = { ...migrated, version: 3 };
  }
  if (migrated.version === 3) {
    migrated = { ...migrated, version: 4 };
  }
  return migrated;
}
