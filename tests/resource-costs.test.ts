import { describe, expect, it } from "vitest";
import { BUILDING_DEFINITIONS, createBuilding, allMaterialsDelivered } from "../src/entities/Building";

describe("building resource costs", () => {
  it("requires delivered materials before construction can finish", () => {
    const house = createBuilding("building-test", "house", 4, 4);
    expect(allMaterialsDelivered(house)).toBe(false);
    house.materialsDelivered.wood = BUILDING_DEFINITIONS.house.costs.wood ?? 0;
    house.materialsDelivered.stone = BUILDING_DEFINITIONS.house.costs.stone ?? 0;
    expect(allMaterialsDelivered(house)).toBe(true);
  });
});
