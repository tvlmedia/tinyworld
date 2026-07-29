import { describe, expect, it } from "vitest";
import { createBuildingAt, createNewGameState } from "../src/app/GameState";
import { FIRE_BALANCE } from "../src/config/fireConfig";
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

  it("caps active fire cells to keep large incidents bounded", () => {
    const state = createNewGameState("bounded-fire", 64);
    for (let y = 2; y < state.world.height - 2; y += 1) {
      for (let x = 2; x < state.world.width - 2; x += 1) {
        const tile = getTile(state.world, x, y);
        if (tile) tile.type = "grass";
        igniteTile(state, x, y);
      }
    }

    expect(state.fires).toHaveLength(FIRE_BALANCE.maxActiveCells);

    state.fires.push(
      ...Array.from({ length: 20 }, (_, index) => ({
        x: index + 2,
        y: 2,
        intensity: 0.8,
        fuel: 5,
        spreadTimer: 2
      }))
    );
    updateFire(state, 0.1);
    expect(state.fires.length).toBeLessThanOrEqual(FIRE_BALANCE.maxActiveCells);
  });
});
