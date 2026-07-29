import { describe, expect, it } from "vitest";
import { createNewGameState } from "../src/app/GameState";
import { deserializeWorld, serializeGame } from "../src/persistence/Serialization";
import { migrateSaveGame } from "../src/persistence/SaveMigrations";

describe("savegame serialization", () => {
  it("roundtrips compact world tile data", () => {
    const state = createNewGameState("save-seed", 64);
    const save = serializeGame(state);
    const world = deserializeWorld(save.world);
    expect(world.seed).toBe(state.world.seed);
    expect(world.tiles[0].type).toBe(state.world.tiles[0].type);
    expect(world.tiles.length).toBe(64 * 64);
  });

  it("migrates version zero saves", () => {
    const save = serializeGame(createNewGameState("migration", 64));
    expect(migrateSaveGame({ ...save, version: 0 }).version).toBe(1);
  });
});
