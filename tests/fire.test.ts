import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { igniteTile, updateFire } from "../src/simulation/FireSystem";
import { getTile } from "../src/world/World";

describe("FireSystem", () => {
  it("ignites burnable land and consumes fuel", () => {
    const state = createNewGameState("fire", 64);
    const point = state.world.spawn;
    const tile = getTile(state.world, point.x + 4, point.y + 4)!;
    tile.type = "forest";
    tile.resourceAmount = 3;
    expect(igniteTile(state, tile.x, tile.y)).toBe(true);
    const before = state.fires[0].fuel;
    updateFire(state, 1);
    expect(state.fires[0].fuel).toBeLessThan(before);
  });

  it("turns burned houses into rebuild projects and removes their residents", () => {
    const state = createNewGameState("house-fire", 64);
    const house = createBuildingAt(state, "house", state.world.spawn.x + 7, state.world.spawn.y + 4, true);
    const residents = state.villagers.slice(0, 2);
    for (const resident of residents) resident.homeId = house.id;

    expect(igniteTile(state, house.x, house.y, 1.6)).toBe(true);
    updateFire(state, 25);

    expect(state.buildings.some((building) => building.id === house.id)).toBe(true);
    expect(house.status).toBe("planned");
    expect(state.villagers.some((villager) => residents.some((resident) => resident.id === villager.id))).toBe(false);
    expect(getTile(state.world, house.x, house.y)?.occupiedByBuildingId).toBe(house.id);
    expect(getTile(state.world, house.x, house.y)?.type).toBe("burned");
  });
});
